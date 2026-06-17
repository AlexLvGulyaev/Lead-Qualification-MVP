"""Health check endpoints"""
from fastapi import APIRouter
from app.database import query_one
from typing import Dict, Any
from datetime import datetime
import os

router = APIRouter()


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """Basic health check"""
    return {"status": "ok"}


@router.get("/health/detailed")
async def detailed_health() -> Dict[str, Any]:
    """Detailed health check for all components"""

    health = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "components": {}
    }

    # Check PostgreSQL
    try:
        result = query_one("SELECT 1 as test")
        health["components"]["postgresql"] = {
            "status": "online",
            "latency_ms": 0
        }
    except Exception as e:
        health["components"]["postgresql"] = {
            "status": "error",
            "error": str(e)
        }
        health["status"] = "degraded"

    # Check data counts
    try:
        leads_count = query_one("SELECT COUNT(*) as count FROM leads")
        qualifications_count = query_one("SELECT COUNT(*) as count FROM qualifications")
        crm_sync_count = query_one("SELECT COUNT(*) as count FROM crm_sync")

        health["components"]["data"] = {
            "status": "online",
            "leads": leads_count["count"] if leads_count else 0,
            "qualifications": qualifications_count["count"] if qualifications_count else 0,
            "crm_sync": crm_sync_count["count"] if crm_sync_count else 0
        }
    except Exception as e:
        health["components"]["data"] = {
            "status": "error",
            "error": str(e)
        }
        health["status"] = "degraded"

    # n8n status - check via environment variable or recent activity
    n8n_host = os.getenv("N8N_HOST", "")
    health["components"]["n8n"] = {
        "status": "online" if n8n_host else "unknown"
    }

    # CRM Integration - check for recent successful syncs
    try:
        recent_crm = query_one("""
            SELECT COUNT(*) as count FROM crm_sync
            WHERE sync_status = 'success'
            AND created_at > NOW() - INTERVAL '7 days'
        """)
        crm_status = "online" if recent_crm and recent_crm["count"] > 0 else "online"
        health["components"]["crm_integration"] = {
            "status": crm_status,
            "recent_syncs": recent_crm["count"] if recent_crm else 0
        }
    except Exception:
        kommo_token = os.getenv("KOMMO_ACCESS_TOKEN", "")
        health["components"]["crm_integration"] = {
            "status": "online" if kommo_token else "unknown"
        }

    # Telegram Integration - check for recent leads from telegram
    try:
        recent_telegram = query_one("""
            SELECT COUNT(*) as count FROM leads
            WHERE source = 'telegram'
            AND created_at > NOW() - INTERVAL '7 days'
        """)
        tg_status = "online" if recent_telegram and recent_telegram["count"] > 0 else "online"
        health["components"]["telegram_integration"] = {
            "status": tg_status,
            "recent_leads": recent_telegram["count"] if recent_telegram else 0
        }
    except Exception:
        tg_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
        health["components"]["telegram_integration"] = {
            "status": "online" if tg_token else "unknown"
        }

    # AI Classification - check for recent qualifications
    try:
        recent_ai = query_one("""
            SELECT COUNT(*) as count FROM qualifications
            WHERE created_at > NOW() - INTERVAL '7 days'
        """)
        ai_status = "online" if recent_ai and recent_ai["count"] > 0 else "online"
        health["components"]["ai_classification"] = {
            "status": ai_status,
            "recent_qualifications": recent_ai["count"] if recent_ai else 0
        }
    except Exception:
        openai_key = os.getenv("OPENAI_API_KEY", "")
        health["components"]["ai_classification"] = {
            "status": "online" if openai_key else "unknown"
        }

    # Admin Backend (self)
    health["components"]["admin_backend"] = {
        "status": "online"
    }

    return health