-- Run once in Supabase dashboard → SQL Editor → New query → Run.
-- Sets up email capture with the "work email only" rule enforced in the DB,
-- so it can't be bypassed even though the page uses the public anon key.

-- 1. The list of subscribers. `domain` is derived automatically from the email.
create table if not exists public.subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  domain      text generated always as (lower(split_part(email, '@', 2))) stored,
  created_at  timestamptz not null default now()
);

-- 2. Domains we reject (free / personal / disposable mailboxes).
create table if not exists public.blocked_domains ( domain text primary key );
insert into public.blocked_domains (domain) values
  ('gmail.com'),('googlemail.com'),('yahoo.com'),('yahoo.co.uk'),('ymail.com'),
  ('rocketmail.com'),('hotmail.com'),('hotmail.co.uk'),('outlook.com'),('live.com'),
  ('msn.com'),('icloud.com'),('me.com'),('mac.com'),('aol.com'),('proton.me'),
  ('protonmail.com'),('pm.me'),('gmx.com'),('gmx.net'),('mail.com'),('zoho.com'),
  ('yandex.com'),('yandex.ru'),('hey.com'),('fastmail.com'),('tutanota.com'),
  ('qq.com'),('163.com'),('126.com'),('sina.com'),('comcast.net'),('verizon.net'),
  ('att.net'),('sbcglobal.net'),('btinternet.com'),
  -- disposable
  ('mailinator.com'),('guerrillamail.com'),('10minutemail.com'),('temp-mail.org'),
  ('tempmail.com'),('throwaway.email'),('trashmail.com'),('getnada.com'),
  ('dispostable.com'),('yopmail.com'),('sharklasers.com'),('maildrop.cc')
on conflict do nothing;

-- 3. Validator: valid format AND domain not in the blocklist.
--    SECURITY DEFINER lets it read blocked_domains regardless of RLS.
create or replace function public.is_work_email(addr text)
returns boolean
language sql stable security definer set search_path = public as $$
  select addr ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     and length(addr) <= 254
     and lower(split_part(addr, '@', 2)) not in (select domain from public.blocked_domains);
$$;

-- 4. Lock the table: RLS on, the public (anon) role may ONLY insert, and only
--    when the email passes is_work_email(). No SELECT policy => the list is
--    not readable from the browser. You read it from the dashboard.
alter table public.subscribers enable row level security;

drop policy if exists "anon insert work emails" on public.subscribers;
create policy "anon insert work emails"
  on public.subscribers for insert to anon
  with check (public.is_work_email(email));

-- View your list anytime in the SQL Editor:
--   select email, domain, created_at from public.subscribers order by created_at desc;
