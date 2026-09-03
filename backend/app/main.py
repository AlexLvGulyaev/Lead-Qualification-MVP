"""Main FastAPI application"""
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api import audit, auth, dashboard, leads, health, logs
from app.api.auth import require_admin

app = FastAPI(
    title="Lead Qualification Admin API",
    description="Admin backend for Lead Qualification system",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Журнал аудита консоли (канон RF): в журнал пишутся только действия
# (мутации + явные пользовательские действия); чтение не пишется.
@app.middleware("http")
async def audit_activity_middleware(request: Request, call_next):
    response = await call_next(request)
    try:
        audit.log_activity(request, response.status_code)
    except Exception:
        pass
    return response


# Routes. Авторизация по токену (канон RF): /auth/whoami — без guard (это
# сама точка входа), /health — без guard (healthcheck контейнера и внешний
# мониторинг, как в RF), остальные роутеры — за Bearer-токеном.
app.include_router(auth.router, prefix="/api/admin", tags=["auth"])
app.include_router(dashboard.router, prefix="/api/admin", tags=["dashboard"],
                   dependencies=[Depends(require_admin)])
app.include_router(leads.router, prefix="/api/admin", tags=["leads"],
                   dependencies=[Depends(require_admin)])
app.include_router(health.router, prefix="/api/admin", tags=["health"])
app.include_router(audit.router, prefix="/api/admin", tags=["audit"],
                   dependencies=[Depends(require_admin)])
app.include_router(logs.router, prefix="/api/admin", tags=["logs"],
                   dependencies=[Depends(require_admin)])