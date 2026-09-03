"""Журнал аудита консоли (канон RF: audit_logs + log_audit + /api/audit).

Философия RF: аудит = журнал ДЕЙСТВИЙ (мутаций). Чтение (GET-обращения
к админ-API) в журнал НЕ пишется — иначе журнал превращается в шум из
health-проверок и просмотров. В LQ вся логика в n8n (админка read-only),
поэтому в штатной работе журнал пуст и наполняется только реальными
мутирующими вызовами. Эндпоинты аудита сами себя не логируют (рекурсия).
"""
import csv
import io
import json
import re
import uuid

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.database import query_db

router = APIRouter()

ROLE_ADMIN = "admin"

_DATE_ONLY = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _ts(value: str, end: bool = False) -> str:
    """Фильтр окна времени: date-only → 00:00:00/23:59:59, ISO datetime — как есть."""
    return f"{value} 23:59:59" if (end and _DATE_ONLY.match(value)) else value

# Префикс админ-API; всё, что под ним, попадает в журнал.
ADMIN_PREFIX = "/api/admin"
# Эндпоинты аудита исключены: иначе журнал рос бы от чтения самого себя.
SELF_PATHS = ("/api/admin/audit", "/api/admin/auth")


def client_ip(request: Request) -> str:
    """IP клиента: X-Forwarded-For → X-Real-IP → request.client.host (канон RF)."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else ""


def resource_type_for(path: str) -> str:
    """Тип ресурса по пути (для фильтра в UI)."""
    tail = path[len(ADMIN_PREFIX):].strip("/")
    if tail.startswith("dashboard"):
        return "dashboard"
    if tail.startswith("health"):
        return "system"
    if tail.startswith("leads"):
        return "lead"
    return tail.split("/")[0] or "admin"


def log_activity(request: Request, status_code: int) -> None:
    """Пишет строку журнала ТОЛЬКО за мутации (не GET): action = endpoint,
    details = query-параметры. Чтение в аудит не пишется (решение владельца:
    сотни страниц read-шума)."""
    path = request.url.path
    if request.method == "GET":
        return
    if not path.startswith(ADMIN_PREFIX) or any(path.startswith(p) for p in SELF_PATHS):
        return
    sql = """
        INSERT INTO audit_logs
            (user_role, action, resource_type, resource_id, ip_address, details)
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    params = request.url.query  # сырая строка query — детали обращения
    try:
        from app.database import get_connection
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, (
                    "admin",
                    path,
                    resource_type_for(path),
                    None,
                    client_ip(request),
                    json.dumps({"query": params, "status": status_code}),
                ))
            conn.commit()
        finally:
            conn.close()
    except Exception:  # аудит не должен ломать основной запрос
        pass


def _insert_audit(action: str, resource_type: str, ip: str, details: dict, role: str = ROLE_ADMIN) -> None:
    sql = """
        INSERT INTO audit_logs
            (user_role, action, resource_type, resource_id, ip_address, details)
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    try:
        from app.database import get_connection
        conn = get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, (role, action, resource_type, None, ip, json.dumps(details)))
            conn.commit()
        finally:
            conn.close()
    except Exception:  # аудит не должен ломать основной запрос
        pass


def log_login(request: Request, role: str = ROLE_ADMIN) -> None:
    """Аудит входа в систему (console_login): успешная валидация токена."""
    _insert_audit("console_login", "auth", client_ip(request), {}, role=role)


def log_export(request: Request, filters: dict) -> None:
    """Аудит действия «Экспорт CSV» — пользовательское действие консоли."""
    _insert_audit("/api/admin/audit/export", "audit", client_ip(request), {"filters": filters})


@router.get("/audit")
def list_audit(
    date_from: str = "",
    date_to: str = "",
    action: str = "",
    resource_type: str = "",
    user_role: str = "",
    limit: int = 25,
    offset: int = 0,
):
    """Список событий с фильтрами и пагинацией."""
    limit = max(1, min(limit, 200))
    where, params = [], []
    if date_from:
        where.append("created_at >= %s")
        params.append(_ts(date_from))
    if date_to:
        where.append("created_at <= %s")
        params.append(_ts(date_to, end=True))
    if action:
        where.append("action ILIKE %s")
        params.append(f"%{action}%")
    if resource_type:
        where.append("resource_type = %s")
        params.append(resource_type)
    if user_role:
        where.append("user_role = %s")
        params.append(user_role)
    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    rows = query_db(
        f"SELECT * FROM audit_logs {where_sql} ORDER BY created_at DESC LIMIT %s OFFSET %s",
        (*params, limit, offset),
    )
    total = query_db(f"SELECT COUNT(*) AS cnt FROM audit_logs {where_sql}", tuple(params))[0]["cnt"]
    return {"total": total, "items": rows}


@router.get("/audit/export")
def export_audit(
    request: Request,
    date_from: str = "",
    date_to: str = "",
    action: str = "",
    resource_type: str = "",
    user_role: str = "",
):
    """Выгрузка журнала в CSV (канон RF: rf_audit_{stamp}.csv)."""
    # Экспорт — действие пользователя консоли: пишем в аудит явно
    # (GET мутационным логгером не пишется).
    log_export(request, {
        "date_from": date_from, "date_to": date_to,
        "action": action, "resource_type": resource_type, "user_role": user_role,
    })
    where, params = [], []
    if date_from:
        where.append("created_at >= %s")
        params.append(_ts(date_from))
    if date_to:
        where.append("created_at <= %s")
        params.append(_ts(date_to, end=True))
    if action:
        where.append("action ILIKE %s")
        params.append(f"%{action}%")
    if resource_type:
        where.append("resource_type = %s")
        params.append(resource_type)
    if user_role:
        where.append("user_role = %s")
        params.append(user_role)
    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    rows = query_db(
        f"SELECT * FROM audit_logs {where_sql} ORDER BY created_at ASC",
        tuple(params),
    )
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=";")
    writer.writerow(["seq_number", "created_at", "action", "resource_type", "resource_id", "user_role", "ip_address", "details"])
    for r in rows:
        writer.writerow([
            r.get("seq_number"), r.get("created_at"), r.get("action"),
            r.get("resource_type"), r.get("resource_id"), r.get("user_role"),
            r.get("ip_address"), json.dumps(r.get("details") or {}, ensure_ascii=False),
        ])
    buf.seek(0)
    stamp = rows[-1]["created_at"].strftime("%Y%m%d") if rows else "empty"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=lq_audit_{stamp}.csv"},
    )


@router.get("/audit/{event_id}")
def get_audit(event_id: str):
    """Одно событие целиком."""
    try:
        uid = uuid.UUID(event_id)
    except ValueError:
        return {"error": "invalid id"}
    rows = query_db("SELECT * FROM audit_logs WHERE id = %s", (str(uid),))
    return rows[0] if rows else {"error": "not found"}