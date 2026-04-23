-- =============================================
-- HOMEBOARD — Reset Script
-- Run this FIRST to clear any partial tables,
-- then run schema.sql immediately after
-- =============================================

-- Drop tables in reverse dependency order
drop table if exists public.event_attendees cascade;
drop table if exists public.events cascade;
drop table if exists public.recipes cascade;
drop table if exists public.profiles cascade;
drop table if exists public.families cascade;

-- Drop helper function if it exists
drop function if exists public.my_family_id();

-- Confirm clean
select 'Reset complete — now run schema.sql' as status;
