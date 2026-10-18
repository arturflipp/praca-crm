-- One private CRM document per authenticated user.
create table if not exists public.crm_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.crm_state enable row level security;

revoke all on table public.crm_state from anon, authenticated;
grant select, insert, update on table public.crm_state to authenticated;

drop policy if exists crm_state_read_own on public.crm_state;
create policy crm_state_read_own
  on public.crm_state for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists crm_state_insert_own on public.crm_state;
create policy crm_state_insert_own
  on public.crm_state for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists crm_state_update_own on public.crm_state;
create policy crm_state_update_own
  on public.crm_state for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
