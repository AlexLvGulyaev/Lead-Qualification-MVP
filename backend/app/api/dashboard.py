"""Dashboard API endpoints"""
from fastapi import APIRouter
from app.database import query_one, query_db
from typing import Dict, Any

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard() -> Dict[str, Any]:
    """Get dashboard metrics"""

    # Total leads
    total = query_one("SELECT COUNT(*) as count FROM leads")
    total_leads = total["count"] if total else 0

    # Leads by type
    by_type_result = query_db(
        "SELECT lead_type, COUNT(*) as count FROM qualifications GROUP BY lead_type"
    )
    by_type = {row["lead_type"]: row["count"] for row in by_type_result} if by_type_result else {}

    # Average confidence
    avg_conf = query_one("SELECT AVG(confidence) as avg FROM qualifications")
    avg_confidence = float(avg_conf["avg"]) if avg_conf and avg_conf["avg"] else 0.0

    # CRM sync status
    crm_result = query_db(
        "SELECT sync_status, COUNT(*) as count FROM crm_sync GROUP BY sync_status"
    )
    crm_sync = {row["sync_status"]: row["count"] for row in crm_result} if crm_result else {}

    # Leads by source
    by_source_result = query_db(
        "SELECT source, COUNT(*) as count FROM leads GROUP BY source"
    )
    by_source = {row["source"]: row["count"] for row in by_source_result} if by_source_result else {}

    # Last 24h
    last_24h_result = query_one(
        "SELECT COUNT(*) as count FROM leads WHERE created_at > NOW() - INTERVAL '24 hours'"
    )
    last_24h = last_24h_result["count"] if last_24h_result else 0

    # Last 7d
    last_7d_result = query_one(
        "SELECT COUNT(*) as count FROM leads WHERE created_at > NOW() - INTERVAL '7 days'"
    )
    last_7d = last_7d_result["count"] if last_7d_result else 0

    # CRM snapshot statistics (tasks are in Kommo, not stored in LQ)
    crm_pipeline_result = query_db(
        """
        SELECT kommo_pipeline_name, COUNT(*) as count
        FROM crm_sync
        WHERE kommo_pipeline_name IS NOT NULL
        GROUP BY kommo_pipeline_name
        """
    )
    by_pipeline = {row["kommo_pipeline_name"]: row["count"] for row in crm_pipeline_result} if crm_pipeline_result else {}

    crm_status_result = query_db(
        """
        SELECT kommo_status_name, COUNT(*) as count
        FROM crm_sync
        WHERE kommo_status_name IS NOT NULL
        GROUP BY kommo_status_name
        """
    )
    by_crm_status = {row["kommo_status_name"]: row["count"] for row in crm_status_result} if crm_status_result else {}

    # Active deals (not closed)
    active_deals_result = query_one(
        "SELECT COUNT(*) as count FROM crm_sync WHERE kommo_lead_id IS NOT NULL AND crm_closed_at IS NULL"
    )
    active_deals = active_deals_result["count"] if active_deals_result else 0

    # Closed deals
    closed_deals_result = query_one(
        "SELECT COUNT(*) as count FROM crm_sync WHERE crm_closed_at IS NOT NULL"
    )
    closed_deals = closed_deals_result["count"] if closed_deals_result else 0

    # Deals with active tasks (tasks managed in Kommo, we only track the flag)
    deals_with_tasks_result = query_one(
        "SELECT COUNT(*) as count FROM crm_sync WHERE crm_has_active_task = TRUE"
    )
    deals_with_tasks = deals_with_tasks_result["count"] if deals_with_tasks_result else 0

    # Initial tasks created
    initial_tasks_result = query_one(
        "SELECT COUNT(*) as count FROM crm_sync WHERE initial_task_created = TRUE"
    )
    initial_tasks = initial_tasks_result["count"] if initial_tasks_result else 0

    # Last CRM sync (24h)
    synced_24h_result = query_one(
        "SELECT COUNT(*) as count FROM crm_sync WHERE crm_synced_at > NOW() - INTERVAL '24 hours'"
    )
    synced_24h = synced_24h_result["count"] if synced_24h_result else 0

    return {
        "leads": {
            "total": total_leads,
            "by_type": {
                "hot": by_type.get("hot", 0),
                "warm": by_type.get("warm", 0),
                "cold": by_type.get("cold", 0),
                "spam": by_type.get("spam", 0)
            },
            "by_source": by_source,
            "last_24h": last_24h,
            "last_7d": last_7d
        },
        "qualifications": {
            "avg_confidence": round(avg_confidence, 2)
        },
        "crm_sync": {
            "success": crm_sync.get("success", 0),
            "pending": crm_sync.get("pending", 0),
            "failed": crm_sync.get("failed", 0)
        },
        "crm_snapshot": {
            "by_pipeline": by_pipeline,
            "by_status": by_crm_status,
            "active_deals": active_deals,
            "closed_deals": closed_deals,
            "deals_with_active_tasks": deals_with_tasks,
            "initial_tasks_created": initial_tasks,
            "synced_last_24h": synced_24h
        }
    }