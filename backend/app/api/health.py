"""Health check endpoints"""
from fastapi import APIRouter
from app.database import query_one
from typing import Dict, Any
from datetime import datetime

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
            "latency_ms": 0  # Would need to measure actual latency
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

    # n8n status (external service - would need actual check)
    health["components"]["n8n"] = {
        "status": "unknown",
        "note": "External service - requires separate check"
    }

    # CRM Integration (external - would need actual check)
    health["components"]["crm_integration"] = {
        "status": "unknown",
        "note": "External service - requires separate check"
    }

    # Telegram Integration (external - would need actual check)
    health["components"]["telegram_integration"] = {
        "status": "unknown",
        "note": "External service - requires separate check"
    }

    # AI Classification (external - would need actual check)
    health["components"]["ai_classification"] = {
        "status": "unknown",
        "note": "External service - requires separate check"
    }

    # Admin Backend (self)
    health["components"]["admin_backend"] = {
        "status": "online"
    }

    return health