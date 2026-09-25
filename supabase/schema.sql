-- ========================================================================
-- IGNOU BCA Cloud Command Centre - Supabase Database Schema
-- Run this script in your Supabase project: SQL Editor -> New Query -> Run
-- ========================================================================

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------------------
-- 1. Table: user_checklist
-- Stores user personal assignment checkboxes, submission dates, proof, notes
-- ------------------------------------------------------------------------
create table if not exists public.user_checklist (
  user_id uuid references auth.users(id) on delete cascade not null,
  item_key text not null,
  checked boolean default false not null,
  value text default '' not null,
  updated_at timestamptz default now() not null,
  primary key (user_id, item_key)
);

-- Enable Row Level Security (RLS)
alter table public.user_checklist enable row level security;

-- Drop existing policies if re-running
drop policy if exists "Users can view their own checklist items" on public.user_checklist;
drop policy if exists "Users can insert their own checklist items" on public.user_checklist;
drop policy if exists "Users can update their own checklist items" on public.user_checklist;
drop policy if exists "Users can delete their own checklist items" on public.user_checklist;

-- RLS Policies: Each student can only read, insert, update, delete their own data
create policy "Users can view their own checklist items"
  on public.user_checklist for select
  using (auth.uid() = user_id);

create policy "Users can insert their own checklist items"
  on public.user_checklist for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own checklist items"
  on public.user_checklist for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own checklist items"
  on public.user_checklist for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------------------
-- 2. Table: notifications
-- Stores public announcements scraped from IGNOU HQ and RC Guwahati
-- ------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  source text not null,
  url text not null,
  matched_courses text[] default '{}',
  detected_at timestamptz default now() not null,
  constraint unique_notice unique (url, title)
);

-- Index for ordering by latest detected notice
create index if not exists idx_notifications_detected_at on public.notifications (detected_at desc);

-- Enable Row Level Security (RLS)
alter table public.notifications enable row level security;

-- Drop existing policies if re-running
drop policy if exists "Anyone can read notifications" on public.notifications;

-- Public read access: Any authenticated or anon dashboard viewer can read public notices
create policy "Anyone can read notifications"
  on public.notifications for select
  using (true);

-- (Inserts / updates are performed by the Vercel cron using the service_role key, which bypasses RLS)

-- ------------------------------------------------------------------------
-- 3. Table: notification_reads
-- Tracks which notifications each student has marked as read
-- ------------------------------------------------------------------------
create table if not exists public.notification_reads (
  user_id uuid references auth.users(id) on delete cascade not null,
  notification_id uuid references public.notifications(id) on delete cascade not null,
  read_at timestamptz default now() not null,
  primary key (user_id, notification_id)
);

-- Enable Row Level Security (RLS)
alter table public.notification_reads enable row level security;

-- Drop existing policies if re-running
drop policy if exists "Users can view their read notices" on public.notification_reads;
drop policy if exists "Users can mark notices as read" on public.notification_reads;
drop policy if exists "Users can update their read status" on public.notification_reads;

create policy "Users can view their read notices"
  on public.notification_reads for select
  using (auth.uid() = user_id);

create policy "Users can mark notices as read"
  on public.notification_reads for insert
  with check (auth.uid() = user_id);

create policy "Users can update their read status"
  on public.notification_reads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
