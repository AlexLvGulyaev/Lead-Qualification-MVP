"""Журнал «Логи» — проекция по обращениям (канон RF LogsWorkspace / AIC OperationalLogs).

Одна строка списка = одно обращение (полный прогон пайплайна лида
«Событие клиента → Обработка → Ответ системы»), а не отдельный этап.
Этапы живут в детализации («Таймлайн pipeline»).

Статус трейса (семья LOG_STATUS): ok — все события успешны и есть
ответ системы (crm_sync*); error — есть событие с ошибкой;
pending — до CRM (Kommo) не достучались: обращения, по которым
crm_sync*-события нет (обработка не завершилась синхронизацией).
"""
from fastapi import APIRouter

from app.database import query_db

router = APIRouter()

# Статус трейса (канон RF LOG_STATUS): ok / error / pending.
SUCCESS_SQL = "NOT BOOL_OR(l.status = 'error')"
RESPONSE_SQL = "MAX(CASE WHEN l.event_type ILIKE 'crm_sync%%' THEN 1 ELSE 0 END) = 1"
ERROR_SQL = "BOOL_OR(l.status = 'error')"
STATUS_HAVING = {
    "ok": f"{SUCCESS_SQL} AND {RESPONSE_SQL}",
    "error": ERROR_SQL,
    "pending": f"{SUCCESS_SQL} AND NOT {RESPONSE_SQL}",
}


@router.get("/logs")
def list_traces(
    status: str = "",
    lead: str = "",
    date_from: str = "",
    limit: int = 25,
    offset: int = 0,
):
    """Список обращений с итогами обработки (одна строка = одно обращение)."""
    limit = max(1, min(limit, 200))
    where, params = [], []
    if lead:
        where.append("ld.public_number ILIKE %s")
        params.append(f"%{lead}%")
    if date_from:
        where.append("l.created_at >= %s")
        params.append(date_from)
    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    having_sql = f"HAVING {STATUS_HAVING[status]}" if status in STATUS_HAVING else ""
    rows = query_db(
        f"""
        SELECT ld.id AS lead_id, ld.public_number,
               MIN(l.created_at) AS started_at,
               MAX(l.created_at) AS updated_at,
               COUNT(*) AS events_count,
               BOOL_OR(l.status = 'error') AS has_error,
               MAX(CASE WHEN l.event_type ILIKE 'crm_sync%%' THEN 1 ELSE 0 END) AS has_response,
               MAX(CASE WHEN l.event_type = 'lead_classified'
                        THEN l.event_data->>'ai_model' END) AS ai_model,
               MAX(CASE WHEN l.event_type = 'lead_classified'
                        AND l.event_data ? 'processing_ms'
                        THEN (l.event_data->>'processing_ms')::bigint END) AS processing_ms,
               STRING_AGG(l.event_type, ' → ' ORDER BY l.created_at) AS pipeline_summary
        FROM logs l JOIN leads ld ON l.lead_id = ld.id
        {where_sql}
        GROUP BY ld.id, ld.public_number
        {having_sql}
        ORDER BY MAX(l.created_at) DESC LIMIT %s OFFSET %s
        """,
        (*params, limit, offset),
    )
    total_row = query_db(
        f"""
        SELECT COUNT(*) AS cnt FROM (
            SELECT ld.id
            FROM logs l JOIN leads ld ON l.lead_id = ld.id
            {where_sql}
            GROUP BY ld.id, ld.public_number
            {having_sql}
        ) t
        """,
        tuple(params),
    )
    items = []
    for r in rows:
        if r["has_error"]:
            trace_status = "error"
        elif r["has_response"]:
            trace_status = "ok"
        else:
            trace_status = "pending"
        items.append({
            "lead_id": str(r["lead_id"]),
            "public_number": r["public_number"],
            "started_at": r["started_at"].isoformat() if r["started_at"] else None,
            "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
            "status": trace_status,
            "events_count": r["events_count"],
            "ai_model": r["ai_model"],
            "processing_ms": r["processing_ms"],
            "pipeline_summary": r["pipeline_summary"],
        })
    return {"total": total_row[0]["cnt"] if total_row else 0, "items": items}


@router.get("/logs/{lead_id}")
def get_trace(lead_id: str):
    """Развёрнутый трейс обращения: вход → этапы → ответ системы."""
    lead = query_db(
        """
        SELECT l.id, l.public_number, l.source, l.status, l.created_at
        FROM leads l WHERE l.id = %s::uuid
        """,
        (lead_id,),
    )
    if not lead:
        return {"error": "Lead not found"}
    lead = lead[0]

    events = query_db(
        """
        SELECT id, event_type, status, event_data, error_message, created_at
        FROM logs WHERE lead_id = %s::uuid ORDER BY created_at
        """,
        (lead_id,),
    )

    # «Запрос пользователя» — первое входящее сообщение клиента.
    message = query_db(
        """
        SELECT content, created_at FROM messages
        WHERE lead_id = %s::uuid AND direction = 'inbound'
        ORDER BY created_at LIMIT 1
        """,
        (lead_id,),
    )

    # «Ответ системы» — результат CRM-синхронизации (создание сделки).
    crm = query_db(
        """
        SELECT sync_status, crm_lead_id, kommo_lead_id, kommo_pipeline_name,
               kommo_status_name, synced_at
        FROM crm_sync WHERE lead_id = %s::uuid
        """,
        (lead_id,),
    )
    crm = crm[0] if crm else None

    qual = query_db(
        """
        SELECT lead_type, priority, confidence, suggested_action
        FROM qualifications WHERE lead_id = %s::uuid
        """,
        (lead_id,),
    )
    qual = qual[0] if qual else None

    has_error = any(e["status"] == "error" for e in events)
    has_response = any(e["event_type"].startswith("crm_sync") for e in events)
    trace_status = "error" if has_error else ("ok" if has_response else "pending")

    msg_row = message[0] if message else None

    response = None
    if crm:
        response = {
            "sync_status": crm["sync_status"],
            "crm_lead_id": crm["crm_lead_id"],
            "kommo_lead_id": crm["kommo_lead_id"],
            "kommo_pipeline_name": crm["kommo_pipeline_name"],
            "kommo_status_name": crm["kommo_status_name"],
            "synced_at": crm["synced_at"].isoformat() if crm["synced_at"] else None,
        }

    # Канон RF: offset = время от старта пайплайна, latency = длительность
    # этапа (до следующего события); для последнего этапа — «—».
    stages = []
    for i, e in enumerate(events):
        offset_ms = None
        latency_ms = None
        if e["created_at"]:
            offset_ms = int((e["created_at"] - events[0]["created_at"]).total_seconds() * 1000)
            if i + 1 < len(events) and events[i + 1]["created_at"]:
                latency_ms = int((events[i + 1]["created_at"] - e["created_at"]).total_seconds() * 1000)
        stages.append({
            "created_at": e["created_at"].isoformat() if e["created_at"] else None,
            "event_type": e["event_type"],
            "status": e["status"],
            "metadata": e["event_data"],
            "error_message": e["error_message"],
            "processing_ms": (e["event_data"] or {}).get("processing_ms")
            if e["event_type"] == "lead_classified" else None,
            "offset_ms": offset_ms,
            "latency_ms": latency_ms,
        })

    return {
        "lead_id": str(lead["id"]),
        "public_number": lead["public_number"],
        "source": lead["source"],
        "lead_status": lead["status"],
        "created_at": lead["created_at"].isoformat() if lead["created_at"] else None,
        "status": trace_status,
        "client_message": msg_row["content"] if msg_row else None,
        "message_at": msg_row["created_at"].isoformat() if msg_row and msg_row["created_at"] else None,
        "qualification": {
            "lead_type": qual["lead_type"] if qual else None,
            "priority": qual["priority"] if qual else None,
            "confidence": float(qual["confidence"]) if qual and qual["confidence"] else None,
            "suggested_action": qual["suggested_action"] if qual else None,
        } if qual else None,
        "response": response,
        "error": next((e["error_message"] for e in events if e["error_message"]), None),
        "stages": stages,
        "pipeline_summary": " → ".join(e["event_type"] for e in events) or None,
        "ai_model": next(
            ((e["event_data"] or {}).get("ai_model") for e in events
             if e["event_type"] == "lead_classified" and e["event_data"]),
            None,
        ),
        "processing_ms": next(
            ((e["event_data"] or {}).get("processing_ms") for e in events
             if e["event_type"] == "lead_classified" and e["event_data"]),
            None,
        ),
    }