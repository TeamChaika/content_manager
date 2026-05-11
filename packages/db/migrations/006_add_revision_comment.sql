-- Add revision tracking to content_plans
ALTER TABLE content_plans ADD COLUMN IF NOT EXISTS revision_comment text;
