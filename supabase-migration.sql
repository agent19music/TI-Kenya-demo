create extension if not exists pgcrypto;

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  raw_complaint text not null,
  ai_category text not null,
  ai_priority text not null,
  ai_confidence integer not null,
  status text not null default 'Pending Review',
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint complaints_ai_confidence_check check (ai_confidence >= 0 and ai_confidence <= 100)
);

create index if not exists complaints_created_at_idx on public.complaints (created_at desc);
create index if not exists complaints_status_idx on public.complaints (status);
create index if not exists complaints_ai_priority_idx on public.complaints (ai_priority);

alter table public.complaints add column if not exists complaint_hash text;
alter table public.complaints add column if not exists ai_summary text;
alter table public.complaints add column if not exists triage_status text not null default 'Pending';
alter table public.complaints add column if not exists triage_error text;
alter table public.complaints add column if not exists sender_country text;
alter table public.complaints add column if not exists sender_city text;
alter table public.complaints add column if not exists report_county text;
alter table public.complaints add column if not exists reporter_age_group text;
alter table public.complaints add column if not exists reporter_sex text;
alter table public.complaints add column if not exists has_disability text;
alter table public.complaints add column if not exists is_anonymous boolean not null default true;
alter table public.complaints add column if not exists reporter_phone text;
alter table public.complaints add column if not exists attachment_url text;
alter table public.complaints add column if not exists attachment_mime text;
alter table public.complaints add column if not exists attachment_name text;
alter table public.complaints add column if not exists attachment_size_bytes integer;
alter table public.complaints add column if not exists duplicate_count integer not null default 1;
alter table public.complaints add column if not exists last_received_at timestamptz not null default timezone('utc'::text, now());
alter table public.complaints add column if not exists recommended_agency text;
alter table public.complaints add column if not exists requires_ipoa_form boolean not null default false;
alter table public.complaints add column if not exists dispatch_status text not null default 'Pending';
alter table public.complaints add column if not exists dispatched_at timestamptz;
alter table public.complaints add column if not exists dispatch_error text;

update public.complaints
set complaint_hash = encode(digest(raw_complaint, 'sha256'), 'hex')
where complaint_hash is null;

alter table public.complaints alter column complaint_hash set not null;

create unique index if not exists complaints_complaint_hash_idx on public.complaints (complaint_hash);
create index if not exists complaints_last_received_at_idx on public.complaints (last_received_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'complaints_recommended_agency_check'
  ) then
    alter table public.complaints
      add constraint complaints_recommended_agency_check
      check (recommended_agency in ('EACC', 'IPOA', 'CAJ') or recommended_agency is null);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'complaints_dispatch_status_check'
  ) then
    alter table public.complaints
      add constraint complaints_dispatch_status_check
      check (dispatch_status in ('Pending', 'Sent', 'Failed'));
  end if;
end $$;
