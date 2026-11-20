-- Orbit task workspace: run this in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 160),
  description text not null default '',
  status text not null default 'todo' check (status in ('todo','in_progress','in_review','done')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  due_date date,
  labels text[] not null default '{}',
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_status_idx on public.tasks(user_id, status);
create index if not exists tasks_user_created_idx on public.tasks(user_id, created_at desc);

alter table public.tasks enable row level security;

create policy "Users can read their own tasks" on public.tasks
  for select to authenticated using (auth.uid() = user_id);
create policy "Users can create their own tasks" on public.tasks
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update their own tasks" on public.tasks
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own tasks" on public.tasks
  for delete to authenticated using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();


