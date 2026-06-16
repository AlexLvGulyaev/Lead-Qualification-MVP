"""Leads API endpoints"""
from fastapi import APIRouter, Query
from app.database import query_db, query_one
from typing import Dict, Any, List, Optional
import uuid
import os

router = APIRouter()

# Kommo subdomain from environment
KOMMO_SUBDOMAIN = os.environ.get('KOMMO_SUBDOMAIN', 'yourcompany')


def get_kommo_deal_url(kommo_lead_id: Optional[int]) -> Optional[str]:
    """Generate Kommo deal URL from lead_id"""
    if kommo_lead_id is None:
        return None
    return f"https://{KOMMO_SUBDOMAIN}.kommo.com/leads/detail/{kommo_lead_id}"


@router.get("/leads")
async def get_leads(
    page: int = Query(0, ge=0),
    size: int = Query(20, ge=1, le=100),
    lead_type: Optional[str] = None,
    status: Optional[str] = None,
    source: Optional[str] = None
) -> Dict[str, Any]:
    """Get leads list with filters"""

    # Build WHERE clause
    conditions = []
    params = []

    if lead_type:
        conditions.append("q.lead_type = %s")
        params.append(lead_type)

    if status:
        conditions.append("l.status = %s")
        params.append(status)

    if source:
        conditions.append("l.source = %s")
        params.append(source)

    where_clause = " AND ".join(conditions) if conditions else "1=1"

    # Count total
    count_query = f"""
        SELECT COUNT(*) as count
        FROM leads l
        LEFT JOIN qualifications q ON l.id = q.lead_id
        WHERE {where_clause}
    """
    total_result = query_one(count_query, params)
    total = total_result["count"] if total_result else 0

    # Get items with contact info
    offset = page * size
    items_query = f"""
        SELECT
            l.id,
            l.public_number,
            COALESCE(l.name, c.name) as name,
            COALESCE(l.phone, c.phone) as phone,
            COALESCE(l.email, c.email) as email,
            l.source,
            l.status,
            l.created_at,
            q.lead_type,
            q.priority,
            q.confidence,
            cs.sync_status as crm_sync_status,
            cs.kommo_lead_id,
            (SELECT m.content FROM messages m WHERE m.lead_id = l.id AND m.direction = 'inbound' ORDER BY m.created_at LIMIT 1) as first_message
        FROM leads l
        LEFT JOIN contacts c ON l.contact_id = c.id
        LEFT JOIN qualifications q ON l.id = q.lead_id
        LEFT JOIN crm_sync cs ON l.id = cs.lead_id
        WHERE {where_clause}
        ORDER BY l.created_at DESC
        LIMIT %s OFFSET %s
    """
    params.extend([size, offset])
    items = query_db(items_query, params)

    # Format results
    formatted_items = []
    for item in items or []:
        formatted_items.append({
            "id": str(item["id"]),
            "public_number": item["public_number"],
            "name": item["name"],
            "phone": item["phone"],
            "email": item["email"],
            "source": item["source"],
            "status": item["status"],
            "lead_type": item["lead_type"],
            "priority": item["priority"],
            "confidence": float(item["confidence"]) if item["confidence"] else None,
            "crm_sync_status": item["crm_sync_status"],
            "kommo_lead_id": item["kommo_lead_id"],
            "first_message": item["first_message"],
            "created_at": item["created_at"].isoformat() if item["created_at"] else None
        })

    return {
        "items": formatted_items,
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size
    }


@router.get("/leads/{lead_id}")
async def get_lead(lead_id: str) -> Dict[str, Any]:
    """Get lead details with CRM snapshot"""

    # Get lead with contact info
    lead = query_one(
        """
        SELECT l.id, l.public_number, l.source, l.status, l.utm_source, l.utm_campaign,
               l.created_at, l.updated_at, l.contact_id,
               COALESCE(l.name, c.name) as name,
               COALESCE(l.phone, c.phone) as phone,
               COALESCE(l.email, c.email) as email
        FROM leads l
        LEFT JOIN contacts c ON l.contact_id = c.id
        WHERE l.id = %s::uuid
        """,
        (lead_id,)
    )

    if not lead:
        return {"error": "Lead not found"}

    # Get qualification
    qualification = query_one(
        """
        SELECT * FROM qualifications WHERE lead_id = %s::uuid
        """,
        (lead_id,)
    )

    # Get messages
    messages = query_db(
        """
        SELECT id, channel, direction, content, created_at
        FROM messages WHERE lead_id = %s::uuid ORDER BY created_at
        """,
        (lead_id,)
    )

    # Get CRM sync snapshot (monitoring only - tasks are in Kommo)
    crm_sync = query_one(
        """
        SELECT
            id, lead_id, crm_type, crm_lead_id, sync_status, sync_error, synced_at, created_at,
            kommo_lead_id, kommo_contact_id, kommo_pipeline_id, kommo_pipeline_name,
            kommo_status_id, kommo_status_name, kommo_responsible_user_id,
            crm_has_active_task, crm_closest_task_at, crm_closed_at, crm_synced_at,
            initial_task_created
        FROM crm_sync WHERE lead_id = %s::uuid
        """,
        (lead_id,)
    )

    # Format response
    result = {
        "lead": {
            "id": str(lead["id"]),
            "public_number": lead["public_number"],
            "name": lead["name"],
            "phone": lead["phone"],
            "email": lead["email"],
            "source": lead["source"],
            "status": lead["status"],
            "utm_source": lead["utm_source"],
            "utm_campaign": lead["utm_campaign"],
            "created_at": lead["created_at"].isoformat() if lead["created_at"] else None,
            "updated_at": lead["updated_at"].isoformat() if lead["updated_at"] else None
        },
        "qualification": {
            "lead_type": qualification["lead_type"] if qualification else None,
            "interest": qualification["interest"] if qualification else None,
            "priority": qualification["priority"] if qualification else None,
            "category": qualification["category"] if qualification else None,
            "summary": qualification["summary"] if qualification else None,
            "confidence": float(qualification["confidence"]) if qualification and qualification["confidence"] else None,
            "suggested_action": qualification["suggested_action"] if qualification else None,
            "reasoning": qualification["reasoning"] if qualification else None,
            "ai_model": qualification["ai_model"] if qualification else None,
            "processing_ms": qualification["processing_ms"] if qualification else None,
            "processed_at": qualification["processed_at"].isoformat() if qualification and qualification["processed_at"] else None
        } if qualification else None,
        "messages": [
            {
                "id": str(msg["id"]),
                "channel": msg["channel"],
                "direction": msg["direction"],
                "content": msg["content"],
                "created_at": msg["created_at"].isoformat() if msg["created_at"] else None
            }
            for msg in messages
        ] if messages else [],
        "crm_sync": {
            # Basic sync info
            "crm_type": crm_sync["crm_type"] if crm_sync else None,
            "crm_lead_id": crm_sync["crm_lead_id"] if crm_sync else None,
            "sync_status": crm_sync["sync_status"] if crm_sync else None,
            "sync_error": crm_sync["sync_error"] if crm_sync else None,
            "synced_at": crm_sync["synced_at"].isoformat() if crm_sync and crm_sync["synced_at"] else None,
            "created_at": crm_sync["created_at"].isoformat() if crm_sync and crm_sync["created_at"] else None,

            # Kommo identifiers
            "kommo_lead_id": crm_sync["kommo_lead_id"] if crm_sync else None,
            "kommo_contact_id": crm_sync["kommo_contact_id"] if crm_sync else None,

            # Pipeline & Status (cached for UI)
            "kommo_pipeline_id": crm_sync["kommo_pipeline_id"] if crm_sync else None,
            "kommo_pipeline_name": crm_sync["kommo_pipeline_name"] if crm_sync else None,
            "kommo_status_id": crm_sync["kommo_status_id"] if crm_sync else None,
            "kommo_status_name": crm_sync["kommo_status_name"] if crm_sync else None,

            # Responsible
            "kommo_responsible_user_id": crm_sync["kommo_responsible_user_id"] if crm_sync else None,
            "kommo_responsible_user_name": None,  # TODO: Fetch from Kommo API or user mapping

            # Task monitoring (tasks are in Kommo, not stored in LQ)
            "crm_has_active_task": crm_sync["crm_has_active_task"] if crm_sync else None,
            "crm_closest_task_at": crm_sync["crm_closest_task_at"].isoformat() if crm_sync and crm_sync["crm_closest_task_at"] else None,

            # Deal status
            "crm_closed_at": crm_sync["crm_closed_at"].isoformat() if crm_sync and crm_sync["crm_closed_at"] else None,
            "crm_synced_at": crm_sync["crm_synced_at"].isoformat() if crm_sync and crm_sync["crm_synced_at"] else None,

            # Initial task flag
            "initial_task_created": crm_sync["initial_task_created"] if crm_sync else None,

            # Kommo URL (generated for UI)
            "kommo_url": get_kommo_deal_url(crm_sync["kommo_lead_id"] if crm_sync else None)
        } if crm_sync else None
    }

    return result