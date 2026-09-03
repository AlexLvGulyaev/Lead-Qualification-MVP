-- 06-audit.sql — Журнал аудита консоли (канон RF: audit_logs)
-- Назначение: активность админ-консоли LQ — каждое обращение к
-- /api/admin/* с IP и параметрами. События n8n живут в logs
-- (03-runtime-objects.sql) и в Мониторинге, сюда не пишутся.
-- Применение: psql -d lead_qualification -f 06-audit.sql

CREATE SEQUENCE IF NOT EXISTS audit_logs_seq_number_seq;

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seq_number BIGINT NOT NULL DEFAULT nextval('audit_logs_seq_number_seq'),
    user_id VARCHAR(64),
    user_name VARCHAR(128),
    user_role VARCHAR(50) NOT NULL DEFAULT 'admin',
    action VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64),
    resource_id VARCHAR(128),
    ip_address VARCHAR(45),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_audit_logs_seq_number ON audit_logs (seq_number);
CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS ix_audit_logs_resource_type ON audit_logs (resource_type);