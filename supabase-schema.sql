-- Run this once in the Supabase dashboard → SQL Editor → New query → Run.
-- Creates the table that stores captured work emails.

create table if not exists public.subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  domain      text,
  created_at  timestamptz not null default now()
);

-- Lock the table down. The /api/subscribe function writes using the
-- service_role key, which bypasses RLS — so we deliberately add NO public
-- policies. With RLS on and no policies, the public anon key can neither
-- read nor write this table directly from the browser. Only your server can.
alter table public.subscribers enable row level security;

-- Optional: query your list later in the SQL Editor with:
--   select email, domain, created_at from public.subscribers order by created_at desc;
