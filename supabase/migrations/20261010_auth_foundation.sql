-- 國大練習 Auth foundation (non-breaking preparation)
-- Apply in Supabase SQL Editor only after reviewing the migration plan.
-- This migration intentionally does NOT change app_state policies or save_app_state grants.
-- Therefore it does not lock out current users; it is preparation, not the final security cutover.

begin;

create table if not exists public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.member_profiles enable row level security;
alter table public.user_roles enable row level security;

-- Users may read their own profile. Profile/role creation and changes are intentionally
-- not granted to clients; provisioning is performed by a trusted administrator workflow.
drop policy if exists "members can read own profile" on public.member_profiles;
create policy "members can read own profile"
  on public.member_profiles
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "users can read own role" on public.user_roles;
create policy "users can read own role"
  on public.user_roles
  for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.member_profiles from anon, authenticated;
revoke all on public.user_roles from anon, authenticated;
grant select on public.member_profiles to authenticated;
grant select on public.user_roles to authenticated;

-- A narrowly-scoped helper for policies/RPCs to check the caller's active role.
-- It reads only the caller's own row and exposes a boolean, not role-table contents.
create or replace function public.current_user_is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.member_profiles p
     where p.user_id = (select auth.uid())
       and p.active = true
  );
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.member_profiles p
      join public.user_roles r on r.user_id = p.user_id
     where p.user_id = (select auth.uid())
       and p.active = true
       and r.role = 'admin'
  );
$$;

revoke all on function public.current_user_is_active_member() from public;
revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_active_member() to authenticated;
grant execute on function public.current_user_is_admin() to authenticated;

commit;

-- Provisioning note:
-- 1) Invite/create a user through Supabase Auth.
-- 2) As a trusted project owner, insert one row into member_profiles for auth.users.id.
-- 3) Insert user_roles with role='member'; grant role='admin' only to designated administrators.
-- Do not add self-service INSERT/UPDATE policies for user_roles.
