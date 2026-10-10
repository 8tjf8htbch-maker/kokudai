-- 國大練習: provision a member who already exists in Supabase Auth.
-- Run in Supabase SQL Editor as project owner after applying
-- 20261010_auth_foundation.sql and inviting/creating the Auth user.
-- Replace the email and display name below. Do not use this for an untrusted email.
begin;

do $$
declare
  target_user_id uuid;
  target_email text := lower(trim('member@example.com'));
  target_display_name text := 'メンバー名';
  target_role text := 'member'; -- use 'admin' only for a trusted administrator
begin
  if target_role not in ('member', 'admin') then
    raise exception 'Invalid role';
  end if;

  select id into target_user_id
    from auth.users
   where lower(email) = target_email
   limit 1;

  if target_user_id is null then
    raise exception 'Supabase Auth user not found for email: %', target_email;
  end if;

  insert into public.member_profiles(user_id, display_name, active)
  values(target_user_id, target_display_name, true)
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        active = true,
        updated_at = now();

  insert into public.user_roles(user_id, role)
  values(target_user_id, target_role)
  on conflict (user_id) do update
    set role = excluded.role,
        updated_at = now();
end $$;

commit;

-- After running, verify with:
-- select u.email, p.display_name, p.active, r.role
-- from auth.users u
-- join public.member_profiles p on p.user_id = u.id
-- join public.user_roles r on r.user_id = u.id
-- where lower(u.email) = lower('member@example.com');
