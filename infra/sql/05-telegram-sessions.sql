-- n8n Lead Qualification Assistant
-- Telegram Sessions Table
-- Version: 1.0
-- Date: 2026-06-15
-- Purpose: Store intermediate dialog state for Telegram bot UX
-- ============================================================================

-- Connect to the business database
\c lead_qualification

-- ============================================================================
-- TABLE: telegram_sessions
-- Purpose: Store intermediate state for multi-step dialog scenarios
-- ============================================================================

CREATE TABLE IF NOT EXISTS telegram_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id VARCHAR(255) NOT NULL UNIQUE,
    chat_id BIGINT NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),

    -- Current dialog state
    current_step VARCHAR(50) NOT NULL DEFAULT 'start',
    -- Possible steps: start, name, phone, email, description, confirm

    -- Collected data (JSONB for flexibility)
    collected_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Structure: {name: '', phone: '', email: '', description: ''}

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT chk_step CHECK (current_step IN ('start', 'name', 'phone', 'email', 'description', 'confirm', 'done'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_telegram_id ON telegram_sessions(telegram_id);
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_chat_id ON telegram_sessions(chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_current_step ON telegram_sessions(current_step);
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_created_at ON telegram_sessions(created_at);

COMMENT ON TABLE telegram_sessions IS 'Intermediate state for Telegram multi-step dialogs';
COMMENT ON COLUMN telegram_sessions.current_step IS 'Current step in dialog: start, name, phone, email, description, confirm, done';
COMMENT ON COLUMN telegram_sessions.collected_data IS 'JSONB with collected form data';

-- ============================================================================
-- FUNCTION: get_or_create_telegram_session
-- Purpose: Get existing session or create new one
-- Returns: Full session record (id, telegram_id, chat_id, current_step, collected_data, etc.)
-- Note: Updates chat_id on conflict to handle user messaging from different chats
-- ============================================================================

CREATE OR REPLACE FUNCTION get_or_create_telegram_session(
    p_telegram_id VARCHAR(255),
    p_chat_id BIGINT,
    p_username VARCHAR(255) DEFAULT NULL,
    p_first_name VARCHAR(255) DEFAULT NULL,
    p_last_name VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    telegram_id VARCHAR(255),
    chat_id BIGINT,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    current_step VARCHAR(50),
    collected_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Insert new session or update existing one
    -- CRITICAL: chat_id is always updated to handle user messaging from different chats
    INSERT INTO telegram_sessions AS ts (
        telegram_id, chat_id, username, first_name, last_name, current_step, collected_data
    )
    VALUES (
        p_telegram_id, p_chat_id, p_username, p_first_name, p_last_name, 'start', '{}'::jsonb
    )
    ON CONFLICT ON CONSTRAINT telegram_sessions_telegram_id_key
    DO UPDATE SET
        username = COALESCE(EXCLUDED.username, ts.username),
        first_name = COALESCE(EXCLUDED.first_name, ts.first_name),
        last_name = COALESCE(EXCLUDED.last_name, ts.last_name),
        chat_id = EXCLUDED.chat_id,  -- CRITICAL: always update chat_id for proper message routing
        updated_at = NOW();

    -- Return the session record
    RETURN QUERY
    SELECT
        ts.id,
        ts.telegram_id::VARCHAR(255),
        ts.chat_id::BIGINT,
        ts.username::VARCHAR(255),
        ts.first_name::VARCHAR(255),
        ts.last_name::VARCHAR(255),
        ts.current_step::VARCHAR(50),
        ts.collected_data::JSONB,
        ts.created_at,
        ts.updated_at,
        ts.completed_at
    FROM telegram_sessions AS ts
    WHERE ts.telegram_id = p_telegram_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_or_create_telegram_session(VARCHAR, BIGINT, VARCHAR, VARCHAR, VARCHAR) IS 'Get existing or create new Telegram session, returns full record. Updates chat_id on conflict for proper message routing.';

-- ============================================================================
-- FUNCTION: update_telegram_session_step
-- Purpose: Update session step and collected data
-- ============================================================================

CREATE OR REPLACE FUNCTION update_telegram_session_step(
    p_telegram_id VARCHAR(255),
    p_step VARCHAR(50),
    p_data_key VARCHAR(50),
    p_data_value TEXT
)
RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
BEGIN
    -- Get session
    SELECT id INTO v_session_id
    FROM telegram_sessions
    WHERE telegram_id = p_telegram_id;

    IF v_session_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Update step and data
    UPDATE telegram_sessions
    SET
        current_step = p_step,
        collected_data = CASE
            WHEN p_data_key IS NOT NULL AND p_data_value IS NOT NULL
            THEN jsonb_set(collected_data, ARRAY[p_data_key], to_jsonb(p_data_value))
            ELSE collected_data
        END,
        updated_at = NOW()
    WHERE id = v_session_id;

    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_telegram_session_step(VARCHAR, VARCHAR, VARCHAR, TEXT) IS 'Update Telegram session step and collected data';

-- ============================================================================
-- FUNCTION: complete_telegram_session
-- Purpose: Mark session as completed
-- ============================================================================

CREATE OR REPLACE FUNCTION complete_telegram_session(
    p_telegram_id VARCHAR(255)
)
RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
BEGIN
    -- Get session
    SELECT id INTO v_session_id
    FROM telegram_sessions
    WHERE telegram_id = p_telegram_id;

    IF v_session_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Mark as completed
    UPDATE telegram_sessions
    SET
        current_step = 'done',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = v_session_id;

    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION complete_telegram_session(VARCHAR) IS 'Mark Telegram session as completed';

-- ============================================================================
-- FUNCTION: reset_telegram_session
-- Purpose: Reset session to start new conversation
-- ============================================================================

CREATE OR REPLACE FUNCTION reset_telegram_session(
    p_telegram_id VARCHAR(255)
)
RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
BEGIN
    -- Get session
    SELECT id INTO v_session_id
    FROM telegram_sessions
    WHERE telegram_id = p_telegram_id;

    IF v_session_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Reset to start
    UPDATE telegram_sessions
    SET
        current_step = 'start',
        collected_data = '{}'::jsonb,
        completed_at = NULL,
        updated_at = NOW()
    WHERE id = v_session_id;

    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_telegram_session(VARCHAR) IS 'Reset Telegram session to start';

-- ============================================================================
-- TRIGGER: Update updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS update_telegram_sessions_updated_at ON telegram_sessions;
CREATE TRIGGER update_telegram_sessions_updated_at
    BEFORE UPDATE ON telegram_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CLEANUP: Remove old sessions after 24 hours
-- ============================================================================

-- Optional: Schedule cleanup with pg_cron or n8n workflow
-- DELETE FROM telegram_sessions WHERE created_at < NOW() - INTERVAL '24 hours';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 05-telegram-sessions completed successfully';
    RAISE NOTICE 'Objects:';
    RAISE NOTICE '  - telegram_sessions table';
    RAISE NOTICE '  - get_or_create_telegram_session() function';
    RAISE NOTICE '  - update_telegram_session_step() function';
    RAISE NOTICE '  - complete_telegram_session() function';
    RAISE NOTICE '  - reset_telegram_session() function';
END $$;