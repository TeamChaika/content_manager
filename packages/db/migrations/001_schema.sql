-- Migration 001: Core Schema
-- Requires: create extension if not exists vector;

-- Restaurants
create table restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  city text,
  timezone text default 'Europe/Moscow',
  iiko_org_id text,
  telegram_channel_id text,
  monthly_video_budget int default 5,
  monthly_image_budget int default 30,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Profiles (extends auth.users)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'viewer' check (role in ('admin', 'manager', 'smm', 'viewer')),
  full_name text,
  telegram_user_id text,
  created_at timestamptz default now()
);

-- Many-to-many: users <-> restaurants
create table restaurant_members (
  restaurant_id uuid not null references restaurants on delete cascade,
  profile_id uuid not null references profiles on delete cascade,
  role text not null check (role in ('manager', 'smm', 'viewer')),
  primary key (restaurant_id, profile_id)
);

-- Brand guidelines with embeddings
create table brand_guidelines (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants on delete cascade,
  section text not null check (section in ('positioning', 'tone_of_voice', 'taboos', 'visual_style', 'menu_highlights')),
  content text not null,
  embedding vector(1536),
  version int default 1,
  is_active boolean default true,
  updated_by uuid references profiles,
  updated_at timestamptz default now()
);
create index idx_brand_guidelines_embedding on brand_guidelines using ivfflat (embedding vector_cosine_ops) with (lists = 50);
create index idx_brand_guidelines_restaurant on brand_guidelines (restaurant_id, section, is_active);

-- Menu items (synced from iiko)
create table menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants on delete cascade,
  iiko_product_id text,
  name text not null,
  category text,
  description text,
  price numeric(10, 2),
  is_seasonal boolean default false,
  is_hero boolean default false,
  margin_class text check (margin_class in ('high', 'medium', 'low')),
  photo_urls text[],
  updated_at timestamptz default now()
);
create index idx_menu_items_restaurant on menu_items (restaurant_id);

-- Media assets
create table assets (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants on delete cascade,
  storage_path text not null,
  type text not null check (type in ('photo', 'video')),
  source text not null check (source in ('shot', 'generated_nano', 'generated_seedance')),
  tags text[],
  description text,
  embedding vector(1536),
  used_in_post_ids uuid[],
  created_at timestamptz default now()
);
create index idx_assets_embedding on assets using ivfflat (embedding vector_cosine_ops) with (lists = 50);
create index idx_assets_restaurant on assets (restaurant_id);

-- Content plans
create table content_plans (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'rejected', 'in_production')),
  strategist_input jsonb,
  strategist_output jsonb,
  feedback_history jsonb[] default '{}',
  approved_by uuid references profiles,
  approved_at timestamptz,
  created_at timestamptz default now()
);
create index idx_content_plans_restaurant on content_plans (restaurant_id, status);
create index idx_content_plans_period on content_plans (restaurant_id, period_start, period_end);

-- Content items (individual posts)
create table content_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references content_plans on delete cascade,
  restaurant_id uuid not null references restaurants on delete cascade,
  scheduled_date date not null,
  format text not null check (format in ('post', 'reel', 'story')),
  topic text,
  goal text check (goal in ('awareness', 'promo', 'engagement')),
  status text not null default 'planned' check (status in ('planned', 'brief_ready', 'awaiting_shoot', 'media_uploaded', 'media_generated', 'copy_ready', 'pending_approval', 'approved', 'published', 'rejected')),
  shoot_brief jsonb,
  raw_media_ids uuid[] default '{}',
  generated_media_ids uuid[] default '{}',
  prompts jsonb,
  copy_text text,
  copy_hashtags text[],
  final_telegram_ready jsonb,
  approval_history jsonb[] default '{}',
  published_at timestamptz,
  created_at timestamptz default now()
);
create index idx_content_items_plan on content_items (plan_id);
create index idx_content_items_restaurant on content_items (restaurant_id, status, scheduled_date);

-- iiko snapshots (daily sales data)
create table iiko_snapshots (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants on delete cascade,
  snapshot_date date not null,
  insights text,
  raw_data jsonb,
  created_at timestamptz default now(),
  unique (restaurant_id, snapshot_date)
);
create index idx_iiko_snapshots_restaurant on iiko_snapshots (restaurant_id, snapshot_date);

-- Weather forecasts
create table weather_forecasts (
  restaurant_id uuid not null references restaurants on delete cascade,
  forecast_date date not null,
  conditions text,
  temp_c int,
  precipitation_mm numeric(5, 1),
  primary key (restaurant_id, forecast_date)
);

-- Job queue for n8n workers
create table jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('generate_plan', 'generate_brief', 'generate_image', 'generate_video', 'generate_copy', 'regenerate_plan', 'prepare_media', 'extract_learning')),
  payload jsonb,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  retry_count int default 0,
  result jsonb,
  error text,
  created_at timestamptz default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index idx_jobs_status on jobs (status, created_at);

-- Feedback learnings (system training from corrections)
create table feedback_learnings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants on delete cascade,
  source_item_id uuid,
  feedback_text text not null,
  extracted_rule text,
  applied_to_guidelines boolean default false,
  created_at timestamptz default now()
);
create index idx_feedback_learnings_restaurant on feedback_learnings (restaurant_id);
