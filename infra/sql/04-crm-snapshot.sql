-- n8n Lead Qualification Assistant
-- CRM Snapshot Migration (Clean Architecture)
-- Version: 2.0
-- Date: 2026-06-15
-- Purpose: Extend crm_sync table for CRM deal monitoring
-- Architecture: Kommo = Sales Execution SOT, LQ = Qualification + Monitoring
--
-- IMPORTANT:
-- - Kommo is the SOT for deals, tasks, and sales execution
-- - LQ stores only monitoring snapshot, not duplicate entities
-- - No local crm_tasks table - tasks managed only in Kommo
-- ============================================================================

-- Connect to the business database
\c lead_qualification

-- ============================================================================
-- CLEANUP: Remove crm_tasks table if exists (from previous migration)
-- Reason: Tasks are managed in Kommo, not duplicated in LQ
-- ============================================================================

DROP TABLE IF EXISTS crm_tasks CASCADE;

-- ============================================================================
-- EXTEND: crm_sync table
-- Purpose: Monitoring snapshot for leads sent to Kommo
-- LQ does NOT manage deals/tasks - only monitors status
-- ============================================================================

-- Add Kommo identifiers
DO $$
BEGIN
    -- Kommo Lead ID (the deal ID in Kommo) - REQUIRED
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_sync' AND column_name = 'kommo_lead_id'
    ) THEN
        ALTER TABLE crm_sync ADD COLUMN kommo_lead_id BIGINT;
        COMMENT ON COLUMN crm_sync.kommo_lead_id IS 'Kommo deal/lead ID - reference to SOT';
    END IF;

    -- Kommo Contact ID (the contact ID in Kommo) - REQUIRED
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_sync' AND column_name = 'kommo_contact_id'
    ) THEN
        ALTER TABLE crm_sync ADD COLUMN kommo_contact_id BIGINT;
        COMMENT ON COLUMN crm_sync.kommo_contact_id IS 'Kommo contact ID';
    END IF;

    -- Pipeline ID - Useful for filtering
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_sync' AND column_name = 'kommo_pipeline_id'
    ) THEN
        ALTER TABLE crm_sync ADD COLUMN kommo_pipeline_id BIGINT;
        COMMENT ON COLUMN crm_sync.kommo_pipeline_id IS 'Kommo pipeline ID';
    END IF;

    -- Pipeline Name - Cached for UI display
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_sync' AND column_name = 'kommo_pipeline_name'
    ) THEN
        ALTER TABLE crm_sync ADD COLUMN kommo_pipeline_name VARCHAR(255);
        COMMENT ON COLUMN crm_sync.kommo_pipeline_name IS 'Kommo pipeline name (cached for UI)';
    END IF;

    -- Status ID - Useful for filtering
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_sync' AND column_name = 'kommo_status_id'
    ) THEN
        ALTER TABLE crm_sync ADD COLUMN kommo_status_id BIGINT;
        COMMENT ON COLUMN crm_sync.kommo_status_id IS 'Kommo status ID in pipeline';
    END IF;

    -- Status Name - Cached for UI display
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_sync' AND column_name = 'kommo_status_name'
    ) THEN
        ALTER TABLE crm_sync ADD COLUMN kommo_status_name VARCHAR(255);
        COMMENT ON COLUMN crm_sync.kommo_status_name IS 'Kommo status name (cached for UI)';
    END IF;

    -- Responsible User ID
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_sync' AND column_name = 'kommo_responsible_user_id'
    ) THEN
        ALTER TABLE crm_sync ADD COLUMN kommo_responsible_user_id BIGINT;
        COMMENT ON COLUMN crm_sync.kommo_responsible_user_id IS 'Kommo responsible user ID';
    END IF;

    -- Has Active Task - REQUIRED for monitoring
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_sync' AND column_name = 'crm_has_active_task'
    ) THEN
        ALTER TABLE crm_sync ADD COLUMN crm_has_active_task BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN crm_sync.crm_has_active_task IS 'Whether deal has active tasks in Kommo';
    END IF;

    -- Closest Task Due - REQUIRED for monitoring
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_sync' AND column_name = 'crm_closest_task_at'
    ) THEN
        ALTER TABLE crm_sync ADD COLUMN crm_closest_task_at TIMESTAMP WITH TIME ZONE;
        COMMENT ON COLUMN crm_sync.crm_closest_task_at IS 'Due date of closest active task in Kommo';
    END IF;

    -- Deal Closed At - REQUIRED for monitoring
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_sync' AND column_name = 'crm_closed_at'
    ) THEN
        ALTER TABLE crm_sync ADD COLUMN crm_closed_at TIMESTAMP WITH TIME ZONE;
        COMMENT ON COLUMN crm_sync.crm_closed_at IS 'When deal was closed (won/lost) in Kommo';
    END IF;

    -- Last CRM Sync Timestamp - REQUIRED
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_sync' AND column_name = 'crm_synced_at'
    ) THEN
        ALTER TABLE crm_sync ADD COLUMN crm_synced_at TIMESTAMP WITH TIME ZONE;
        COMMENT ON COLUMN crm_sync.crm_synced_at IS 'Last successful CRM sync timestamp';
    END IF;

    -- Raw Snapshot for Debug - OPTIONAL, may be removed later
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_sync' AND column_name = 'crm_raw_snapshot'
    ) THEN
        ALTER TABLE crm_sync ADD COLUMN crm_raw_snapshot JSONB;
        COMMENT ON COLUMN crm_sync.crm_raw_snapshot IS 'Raw CRM deal data (JSONB) for debug - NOT SOT, SOT is Kommo';
    END IF;

    -- Initial Task Created Flag - REQUIRED
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'crm_sync' AND column_name = 'initial_task_created'
    ) THEN
        ALTER TABLE crm_sync ADD COLUMN initial_task_created BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN crm_sync.initial_task_created IS 'Whether initial task was created in Kommo';
    END IF;

END $$;

-- ============================================================================
-- INDEXES: Performance optimization for monitoring queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_crm_sync_kommo_lead_id ON crm_sync(kommo_lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync_kommo_pipeline_id ON crm_sync(kommo_pipeline_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync_kommo_status_id ON crm_sync(kommo_status_id);
CREATE INDEX IF NOT EXISTS idx_crm_sync_crm_synced_at ON crm_sync(crm_synced_at);
CREATE INDEX IF NOT EXISTS idx_crm_sync_crm_closest_task_at ON crm_sync(crm_closest_task_at);
CREATE INDEX IF NOT EXISTS idx_crm_sync_crm_has_active_task ON crm_sync(crm_has_active_task);

-- ============================================================================
-- VIEW: leads_with_crm_snapshot
-- Purpose: Convenient view for Admin UI to show leads with CRM status
-- Note: Does NOT include tasks - tasks are managed in Kommo only
-- ============================================================================

CREATE OR REPLACE VIEW leads_with_crm_snapshot AS
SELECT
    l.id,
    l.public_number,
    l.source,
    l.status,
    l.created_at,
    l.updated_at,

    -- Contact info
    c.name AS contact_name,
    c.phone AS contact_phone,
    c.email AS contact_email,

    -- Qualification info
    q.lead_type,
    q.priority,
    q.confidence,
    q.summary,

    -- CRM sync info (monitoring snapshot)
    cs.crm_type,
    cs.kommo_lead_id,
    cs.kommo_contact_id,
    cs.kommo_pipeline_id,
    cs.kommo_pipeline_name,
    cs.kommo_status_id,
    cs.kommo_status_name,
    cs.kommo_responsible_user_id,
    cs.crm_has_active_task,
    cs.crm_closest_task_at,
    cs.crm_closed_at,
    cs.crm_synced_at,
    cs.sync_status AS crm_sync_status,
    cs.initial_task_created

FROM leads l
LEFT JOIN contacts c ON l.contact_id = c.id
LEFT JOIN qualifications q ON l.id = q.lead_id
LEFT JOIN crm_sync cs ON l.id = cs.lead_id
ORDER BY l.created_at DESC;

COMMENT ON VIEW leads_with_crm_snapshot IS 'Leads with CRM monitoring snapshot - tasks managed in Kommo only';

-- ============================================================================
-- FUNCTION: get_crm_dashboard_stats
-- Purpose: Aggregate statistics for Admin UI dashboard
-- Note: No task statistics - tasks are in Kommo
-- ============================================================================

CREATE OR REPLACE FUNCTION get_crm_dashboard_stats()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_leads', (SELECT COUNT(*) FROM leads),
        'leads_with_crm', (SELECT COUNT(*) FROM crm_sync WHERE kommo_lead_id IS NOT NULL),
        'sync_pending', (SELECT COUNT(*) FROM crm_sync WHERE sync_status = 'pending'),
        'sync_success', (SELECT COUNT(*) FROM crm_sync WHERE sync_status = 'success'),
        'sync_failed', (SELECT COUNT(*) FROM crm_sync WHERE sync_status = 'failed'),
        'active_deals', (SELECT COUNT(*) FROM crm_sync WHERE kommo_lead_id IS NOT NULL AND crm_closed_at IS NULL),
        'closed_deals', (SELECT COUNT(*) FROM crm_sync WHERE crm_closed_at IS NOT NULL),
        'deals_with_tasks', (SELECT COUNT(*) FROM crm_sync WHERE crm_has_active_task = TRUE),
        'initial_tasks_created', (SELECT COUNT(*) FROM crm_sync WHERE initial_task_created = TRUE),
        'synced_last_24h', (SELECT COUNT(*) FROM crm_sync WHERE crm_synced_at > NOW() - INTERVAL '24 hours'),
        'by_pipeline', (
            SELECT COALESCE(jsonb_object_agg(kommo_pipeline_name, cnt), '{}'::jsonb)
            FROM (
                SELECT kommo_pipeline_name, COUNT(*) as cnt
                FROM crm_sync
                WHERE kommo_pipeline_name IS NOT NULL
                GROUP BY kommo_pipeline_name
            ) t
        ),
        'by_status', (
            SELECT COALESCE(jsonb_object_agg(kommo_status_name, cnt), '{}'::jsonb)
            FROM (
                SELECT kommo_status_name, COUNT(*) as cnt
                FROM crm_sync
                WHERE kommo_status_name IS NOT NULL
                GROUP BY kommo_status_name
            ) t
        ),
        'by_lead_type', (
            SELECT COALESCE(jsonb_object_agg(lead_type, cnt), '{}'::jsonb)
            FROM (
                SELECT q.lead_type, COUNT(*) as cnt
                FROM qualifications q
                JOIN leads l ON q.lead_id = l.id
                GROUP BY q.lead_type
            ) t
        )
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_crm_dashboard_stats() IS 'Get CRM dashboard statistics - tasks are in Kommo';

-- ============================================================================
-- FUNCTION: get_kommo_deal_url
-- Purpose: Generate Kommo deal URL from lead_id
-- Usage: SELECT get_kommo_deal_url(kommo_lead_id, 'subdomain');
-- ============================================================================

CREATE OR REPLACE FUNCTION get_kommo_deal_url(
    p_kommo_lead_id BIGINT,
    p_subdomain VARCHAR(255)
)
RETURNS VARCHAR(255) AS $$
BEGIN
    IF p_kommo_lead_id IS NULL OR p_subdomain IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN 'https://' || p_subdomain || '.kommo.com/leads/detail/' || p_kommo_lead_id::TEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_kommo_deal_url(BIGINT, VARCHAR) IS 'Generate Kommo deal URL from lead_id and subdomain';

-- ============================================================================
-- CONSTRAINTS: Ensure data integrity
-- ============================================================================

-- Ensure crm_synced_at is updated when sync happens
-- Note: This is handled by application logic, not trigger

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 04-crm-snapshot (Clean Architecture) completed successfully';
    RAISE NOTICE 'Architecture: Kommo = Sales Execution SOT, LQ = Qualification + Monitoring';
    RAISE NOTICE 'Objects:';
    RAISE NOTICE '  - crm_sync extended with 12 columns (monitoring snapshot)';
    RAISE NOTICE '  - crm_tasks table removed (tasks in Kommo only)';
    RAISE NOTICE '  - leads_with_crm_snapshot view (no tasks)';
    RAISE NOTICE '  - get_crm_dashboard_stats() function';
    RAISE NOTICE '  - get_kommo_deal_url() function';
END $$;