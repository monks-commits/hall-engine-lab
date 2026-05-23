create table if not exists recovery_events (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  original_event text,
  recovery_event text,

  event_date timestamptz,
  recovery_date timestamptz,

  created_at timestamptz default now()
);

create table if not exists recovery_tokens (
  id uuid primary key default gen_random_uuid(),

  recovery_event_id uuid references recovery_events(id) on delete cascade,

  token text not null,
  seat_label text,

  owner_name text,
  owner_email text,
  owner_phone text,

  compensation_allowed boolean default true,
  compensation_used boolean default false,

  compensation_used_at timestamptz,
  compensation_used_by text,

  created_at timestamptz default now()
);

create index if not exists idx_recovery_token
on recovery_tokens(token);

create table if not exists recovery_audit (
  id bigint generated always as identity primary key,

  recovery_event_id uuid,
  token text,

  action text,
  result text,

  scanned_by text,

  meta jsonb,

  created_at timestamptz default now()
);
