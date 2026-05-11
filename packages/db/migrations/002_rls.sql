-- Migration 002: Row Level Security
-- Enables multi-tenancy: manager of restaurant A cannot see data of restaurant B

-- Enable RLS on all tenant-scoped tables
alter table restaurants enable row level security;
alter table profiles enable row level security;
alter table restaurant_members enable row level security;
alter table brand_guidelines enable row level security;
alter table menu_items enable row level security;
alter table assets enable row level security;
alter table content_plans enable row level security;
alter table content_items enable row level security;
alter table iiko_snapshots enable row level security;
alter table weather_forecasts enable row level security;
alter table jobs enable row level security;
alter table feedback_learnings enable row level security;

-- Helper function: check if current user is admin
create or replace function is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- Helper function: get user's accessible restaurant ids
create or replace function user_restaurant_ids()
returns setof uuid as $$
begin
  return query
    select rm.restaurant_id from restaurant_members rm
    where rm.profile_id = auth.uid();
end;
$$ language plpgsql security definer;

-- Helper function: check if user has access to a given restaurant
create or replace function can_access_restaurant(restaurant_id uuid)
returns boolean as $$
begin
  return is_admin() or exists (
    select 1 from restaurant_members
    where profile_id = auth.uid() and restaurant_members.restaurant_id = can_access_restaurant.restaurant_id
  );
end;
$$ language plpgsql security definer;

-- restaurants: admins see all, members see their own
create policy "admins_see_all_restaurants" on restaurants
  for select using (is_admin());

create policy "members_see_own_restaurants" on restaurants
  for select using (
    id in (select user_restaurant_ids())
  );

-- profiles: users can read their own profile, admins can read all
create policy "users_read_own_profile" on profiles
  for select using (id = auth.uid() or is_admin());

create policy "users_update_own_profile" on profiles
  for update using (id = auth.uid());

-- restaurant_members: admins see all, users see their own memberships
create policy "admins_see_all_members" on restaurant_members
  for select using (is_admin());

create policy "users_see_own_memberships" on restaurant_members
  for select using (profile_id = auth.uid());

-- brand_guidelines: check restaurant access
create policy "brand_guidelines_access" on brand_guidelines
  for select using (can_access_restaurant(restaurant_id));

create policy "brand_guidelines_insert" on brand_guidelines
  for insert with check (can_access_restaurant(restaurant_id));

create policy "brand_guidelines_update" on brand_guidelines
  for update using (can_access_restaurant(restaurant_id));

-- menu_items
create policy "menu_items_select" on menu_items
  for select using (can_access_restaurant(restaurant_id));

create policy "menu_items_insert" on menu_items
  for insert with check (can_access_restaurant(restaurant_id));

create policy "menu_items_update" on menu_items
  for update using (can_access_restaurant(restaurant_id));

-- assets
create policy "assets_select" on assets
  for select using (can_access_restaurant(restaurant_id));

create policy "assets_insert" on assets
  for insert with check (can_access_restaurant(restaurant_id));

-- content_plans
create policy "content_plans_select" on content_plans
  for select using (can_access_restaurant(restaurant_id));

create policy "content_plans_insert" on content_plans
  for insert with check (can_access_restaurant(restaurant_id));

create policy "content_plans_update" on content_plans
  for update using (can_access_restaurant(restaurant_id));

-- content_items
create policy "content_items_select" on content_items
  for select using (can_access_restaurant(restaurant_id));

create policy "content_items_insert" on content_items
  for insert with check (can_access_restaurant(restaurant_id));

create policy "content_items_update" on content_items
  for update using (can_access_restaurant(restaurant_id));

-- iiko_snapshots
create policy "iiko_snapshots_select" on iiko_snapshots
  for select using (can_access_restaurant(restaurant_id));

create policy "iiko_snapshots_insert" on iiko_snapshots
  for insert with check (can_access_restaurant(restaurant_id));

-- weather_forecasts
create policy "weather_forecasts_select" on weather_forecasts
  for select using (can_access_restaurant(restaurant_id));

create policy "weather_forecasts_insert" on weather_forecasts
  for insert with check (can_access_restaurant(restaurant_id));

create policy "weather_forecasts_update" on weather_forecasts
  for update using (can_access_restaurant(restaurant_id));

-- jobs: only admins see all, members see nothing (jobs are internal)
create policy "jobs_admin_only" on jobs
  for all using (is_admin());

-- feedback_learnings
create policy "feedback_learnings_select" on feedback_learnings
  for select using (can_access_restaurant(restaurant_id));

create policy "feedback_learnings_insert" on feedback_learnings
  for insert with check (can_access_restaurant(restaurant_id));

-- Helper: auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data ->> 'full_name', 'viewer');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger: auto-create profile
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
