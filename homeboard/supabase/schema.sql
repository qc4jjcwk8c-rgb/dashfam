-- =============================================
-- HOMEBOARD – Supabase Schema
-- Run this in your Supabase SQL editor
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- PROFILES (extends Supabase auth.users)
-- =============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  family_id uuid,
  display_name text not null,
  initials text not null,
  color text not null default '#2D5A27',
  role text not null check (role in ('parent', 'child')) default 'child',
  created_at timestamptz default now()
);

-- =============================================
-- FAMILIES
-- =============================================
create table public.families (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- Add family_id FK after both tables exist
alter table public.profiles
  add constraint profiles_family_id_fkey
  foreign key (family_id) references public.families(id) on delete set null;

-- =============================================
-- EVENTS (Calendar)
-- =============================================
create table public.events (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid references public.families(id) on delete cascade not null,
  created_by uuid references public.profiles(id),
  title text not null,
  description text,
  event_date date not null,
  start_time time,
  end_time time,
  event_type text check (event_type in ('appointment','event','activity','other')) default 'event',
  color text default '#2D5A27',
  color_bg text default '#EAF3DE',
  source text check (source in ('manual','email','ical')) default 'manual',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Event attendees (many-to-many)
create table public.event_attendees (
  event_id uuid references public.events(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  primary key (event_id, profile_id)
);

-- =============================================
-- RECIPES
-- =============================================
create table public.recipes (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid references public.families(id) on delete cascade not null,
  created_by uuid references public.profiles(id),
  title text not null,
  description text,
  url text,
  source_type text check (source_type in ('manual','youtube','instagram','website','email')) default 'manual',
  emoji text default '🍳',
  scheduled_date date,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Profiles: users can read all profiles in their family, edit only their own
alter table public.profiles enable row level security;

create policy "profiles_read_family" on public.profiles
  for select using (
    family_id = (select family_id from public.profiles where id = auth.uid())
    or id = auth.uid()
  );

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

-- Families: members can read their own family
alter table public.families enable row level security;

create policy "families_read_own" on public.families
  for select using (
    id = (select family_id from public.profiles where id = auth.uid())
  );

create policy "families_insert" on public.families
  for insert with check (true);

create policy "families_update_own" on public.families
  for update using (
    id = (select family_id from public.profiles where id = auth.uid())
  );

-- Events: family members can read all; parents can insert/update/delete
alter table public.events enable row level security;

create policy "events_read_family" on public.events
  for select using (
    family_id = (select family_id from public.profiles where id = auth.uid())
  );

create policy "events_insert_parent" on public.events
  for insert with check (
    family_id = (select family_id from public.profiles where id = auth.uid())
    and (
      (select role from public.profiles where id = auth.uid()) = 'parent'
      or event_type = 'activity'
    )
  );

create policy "events_update_parent" on public.events
  for update using (
    family_id = (select family_id from public.profiles where id = auth.uid())
    and (
      (select role from public.profiles where id = auth.uid()) = 'parent'
      or created_by = auth.uid()
    )
  );

create policy "events_delete_parent" on public.events
  for delete using (
    family_id = (select family_id from public.profiles where id = auth.uid())
    and (
      (select role from public.profiles where id = auth.uid()) = 'parent'
      or created_by = auth.uid()
    )
  );

-- Event attendees
alter table public.event_attendees enable row level security;

create policy "event_attendees_read_family" on public.event_attendees
  for select using (
    exists (
      select 1 from public.events e
      join public.profiles p on p.id = auth.uid()
      where e.id = event_id and e.family_id = p.family_id
    )
  );

create policy "event_attendees_write_family" on public.event_attendees
  for all using (
    exists (
      select 1 from public.events e
      join public.profiles p on p.id = auth.uid()
      where e.id = event_id and e.family_id = p.family_id
    )
  );

-- Recipes: family members can read; parents can write
alter table public.recipes enable row level security;

create policy "recipes_read_family" on public.recipes
  for select using (
    family_id = (select family_id from public.profiles where id = auth.uid())
  );

create policy "recipes_insert_parent" on public.recipes
  for insert with check (
    family_id = (select family_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) = 'parent'
  );

create policy "recipes_update_parent" on public.recipes
  for update using (
    family_id = (select family_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) = 'parent'
  );

create policy "recipes_delete_parent" on public.recipes
  for delete using (
    family_id = (select family_id from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) = 'parent'
  );

-- =============================================
-- SERVICE ROLE POLICY (for Netlify functions)
-- These allow the service key to bypass RLS
-- =============================================
-- Service role bypasses RLS by default in Supabase — no extra config needed.

-- =============================================
-- REALTIME (optional — for live updates)
-- =============================================
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.recipes;
alter publication supabase_realtime add table public.event_attendees;

-- =============================================
-- HELPER FUNCTION: get current user's family_id
-- =============================================
create or replace function public.my_family_id()
returns uuid language sql stable security definer as $$
  select family_id from public.profiles where id = auth.uid()
$$;
