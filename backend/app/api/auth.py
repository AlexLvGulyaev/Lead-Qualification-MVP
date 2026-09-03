"""Авторизация консоли по токену (канон RF auth.py: Bearer + /whoami).

Нет заголовка Authorization → 401; токен неверный → 403; токены не настроены
на сервере → авторизация выключена (dev-режим, как ops_auth_enabled в RF).
Два токена (канон RF roles.py): ADMIN_TOKEN → роль admin, ADMIN_DEMO_TOKEN →
роль demo (read-only просмотр; в LQ консоль и так read-only, роль различает
записи в аудите). Успешный вход (whoami с валидным токеном) пишется в аудит
— «входы в систему» аудируются (решение владельца; в RF так аудируются
demo-входы).
"""
from fastapi import APIRouter, HTTPException, Request, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

router = APIRouter()
bearer = HTTPBearer(auto_error=False)

# Роли консоли (канон RF: administrator / demo; чипы AUDIT_ROLE в карте свойств).
ROLE_ADMIN = "admin"
ROLE_DEMO = "demo"


def _role_from_token(token: str) -> str | None:
    """Канон RF _role_from_token: токен → роль, иначе None."""
    if settings.admin_token and token == settings.admin_token:
        return ROLE_ADMIN
    if settings.admin_demo_token and token == settings.admin_demo_token:
        return ROLE_DEMO
    return None


def _resolve_role(
    credentials: HTTPAuthorizationCredentials | None,
) -> str:
    """Общая проверка: возвращает роль или бросает 401/403 (канон RF ops_identity)."""
    if not settings.admin_token and not settings.admin_demo_token:
        return ROLE_ADMIN  # авторизация выключена (dev)
    if credentials is None:
        raise HTTPException(401, "Ops token required", headers={"WWW-Authenticate": "Bearer"})
    role = _role_from_token(credentials.credentials)
    if role is None:
        raise HTTPException(403, "Invalid ops token")
    return role


def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Security(bearer),
) -> None:
    """Guard для всех роутеров админ-API, кроме /auth/* (канон RF ops_identity)."""
    _resolve_role(credentials)


@router.get("/auth/whoami")
def whoami(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer),
):
    """Валидация токена для формы входа (канон RF whoami) + аудит входа."""
    role = _resolve_role(credentials)
    # Аудит входа в систему (аналог review_submitted/demo_session_started в RF).
    from app.api.audit import log_login

    log_login(request, role)
    return {"role": role}


@router.get("/auth/demo-config")
def demo_config():
    """Публичная точка демо-входа для статического UI (без сборки).

    Канон RF: демо-токен лежит в собранном бандле в открытом виде — это
    публичный read-only доступ. Здесь тот же контракт через эндпоинт:
    настроен → {enabled, token, role}; не настроен → {enabled: false}
    (кнопка «Войти в демо-режим» на форме входа скрыта).
    """
    if not settings.admin_demo_token:
        return {"enabled": False}
    return {"enabled": True, "token": settings.admin_demo_token, "role": ROLE_DEMO}