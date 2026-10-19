-- Teacher Studio V1: starter schema for a controlled fictional-data pilot.
-- Run ONCE in a NEW Supabase project. Independent security/compliance review is required
-- before real student personally identifiable information is entered.
-- Never place a service_role/secret key in a browser or distribute it with the app.

create schema if not exists private;

create table if not exists public.classrooms (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 100),
 grade text not null default '5' check (char_length(grade) <= 12),
 allow_parent_replies boolean not null default true,
 share_grades boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists classrooms_teacher_idx on public.classrooms(teacher_id);

create table if not exists public.students (
 id uuid primary key default gen_random_uuid(),
 classroom_id uuid not null references public.classrooms(id) on delete cascade,
 display_name text not null check (char_length(display_name) between 1 and 80),
 created_at timestamptz not null default now(),
 unique(id,classroom_id)
);
create index if not exists students_classroom_idx on public.students(classroom_id);

create table if not exists public.guardian_links (
 id uuid primary key default gen_random_uuid(),
 classroom_id uuid not null references public.classrooms(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete cascade,
 guardian_id uuid not null references auth.users(id) on delete cascade,
 guardian_email text not null,
 created_at timestamptz not null default now(),
 unique(student_id,guardian_id)
);
create index if not exists guardians_owner_idx on public.guardian_links(guardian_id);
create index if not exists guardians_classroom_idx on public.guardian_links(classroom_id);

create table if not exists public.invitations (
 id uuid primary key default gen_random_uuid(),
 classroom_id uuid not null references public.classrooms(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete cascade,
 email text not null check(char_length(email) between 3 and 254),
 token_hash text not null unique check(char_length(token_hash)=64),
 expires_at timestamptz not null,
 used_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists invitations_classroom_idx on public.invitations(classroom_id);

create table if not exists public.assignments (
 id uuid primary key default gen_random_uuid(),
 classroom_id uuid not null references public.classrooms(id) on delete cascade,
 student_id uuid references public.students(id) on delete cascade,
 title text not null check(char_length(title) between 1 and 180),
 instructions text not null default '' check(char_length(instructions) <= 20000),
 kind text not null default 'text' check(kind in ('text','uploaded','arcade')),
 due_date date,
 activity_config jsonb,
 attachment_path text,
 attachment_name text,
 created_at timestamptz not null default now()
);
create index if not exists assignments_classroom_idx on public.assignments(classroom_id);

create table if not exists public.results (
 id uuid primary key default gen_random_uuid(),
 classroom_id uuid not null references public.classrooms(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete cascade,
 assignment_id uuid not null references public.assignments(id) on delete cascade,
 score integer not null check(score>=0),
 max_score integer not null check(max_score>0 and score<=max_score),
 notes text not null default '' check(char_length(notes)<=1000),
 released_at timestamptz,
 created_at timestamptz not null default now(),
 unique(student_id,assignment_id)
);
create index if not exists results_classroom_idx on public.results(classroom_id);

create table if not exists public.messages (
 id uuid primary key default gen_random_uuid(),
 classroom_id uuid not null references public.classrooms(id) on delete cascade,
 student_id uuid references public.students(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid references auth.users(id) on delete cascade,
 kind text not null check (kind in ('announcement','direct')),
 body text not null check(char_length(body) between 1 and 3000),
 created_at timestamptz not null default now(),
 check ((kind='announcement' and student_id is null and recipient_id is null)
 or (kind='direct' and student_id is not null and recipient_id is not null))
);
create index if not exists messages_classroom_idx on public.messages(classroom_id,created_at);
create index if not exists messages_recipient_idx on public.messages(recipient_id);

create table if not exists public.practice_attempts (
 id uuid primary key default gen_random_uuid(),
 classroom_id uuid not null references public.classrooms(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete cascade,
 assignment_id uuid not null references public.assignments(id) on delete cascade,
 guardian_id uuid not null references auth.users(id) on delete cascade,
 score integer not null check(score>=0),
 max_score integer not null check(max_score>0 and score<=max_score),
 created_at timestamptz not null default now()
);
create index if not exists attempts_classroom_idx on public.practice_attempts(classroom_id);
create index if not exists attempts_guardian_idx on public.practice_attempts(guardian_id);

-- Explicit privilege boundaries. Every exposed table is protected by RLS.
alter table public.classrooms enable row level security;
alter table public.students enable row level security;
alter table public.guardian_links enable row level security;
alter table public.invitations enable row level security;
alter table public.assignments enable row level security;
alter table public.results enable row level security;
alter table public.messages enable row level security;
alter table public.practice_attempts enable row level security;
revoke all on public.classrooms,public.students,public.guardian_links,public.invitations,public.assignments,public.results,public.messages,public.practice_attempts from anon, authenticated;
grant select,insert,update,delete on public.classrooms to authenticated;
grant select,insert,delete on public.students to authenticated;
grant select on public.guardian_links to authenticated;
grant select,insert on public.invitations to authenticated;
grant select,insert,update,delete on public.assignments to authenticated;
grant select,insert,update on public.results to authenticated;
grant select,insert on public.messages to authenticated;
grant select,insert on public.practice_attempts to authenticated;

-- Helpers deliberately live in a NON-EXPOSED schema and have a pinned search path.
create or replace function private.is_teacher(p_classroom uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.classrooms c where c.id=p_classroom and c.teacher_id=(select auth.uid())) $$;
create or replace function private.is_guardian_class(p_classroom uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.guardian_links g where g.classroom_id=p_classroom and g.guardian_id=(select auth.uid())) $$;
create or replace function private.is_guardian_student(p_student uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.guardian_links g join public.students s on s.id=g.student_id and s.classroom_id=g.classroom_id where g.student_id=p_student and g.guardian_id=(select auth.uid())) $$;
create or replace function private.student_in_class(p_student uuid,p_classroom uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.students s where s.id=p_student and s.classroom_id=p_classroom) $$;
create or replace function private.assignment_ok(p_assignment uuid,p_classroom uuid,p_student uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.assignments a where a.id=p_assignment and a.classroom_id=p_classroom and (a.student_id is null or a.student_id=p_student)) $$;
create or replace function private.guardian_has_assignment(p_assignment uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.assignments a join public.guardian_links g on g.classroom_id=a.classroom_id
 where a.id=p_assignment and g.guardian_id=(select auth.uid()) and (a.student_id is null or a.student_id=g.student_id)) $$;
create or replace function private.guardian_target(p_classroom uuid,p_student uuid,p_guardian uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.guardian_links g where g.classroom_id=p_classroom and g.student_id=p_student and g.guardian_id=p_guardian) $$;
create or replace function private.is_teacher_uid(p_classroom uuid,p_user uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.classrooms c where c.id=p_classroom and c.teacher_id=p_user) $$;
create or replace function private.grades_visible(p_classroom uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.classrooms c where c.id=p_classroom and c.share_grades=true) $$;
create or replace function private.parent_replies_allowed(p_classroom uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.classrooms c where c.id=p_classroom and c.allow_parent_replies=true) $$;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
-- Helpers are evaluated by policies on behalf of authenticated users.
grant execute on all functions in schema private to authenticated;

create policy "teacher creates classrooms" on public.classrooms for insert to authenticated
 with check(teacher_id=(select auth.uid()));
create policy "teacher or linked guardians read classrooms" on public.classrooms for select to authenticated
 using(teacher_id=(select auth.uid()) or private.is_guardian_class(id));
create policy "teacher updates own classroom" on public.classrooms for update to authenticated
 using(teacher_id=(select auth.uid())) with check(teacher_id=(select auth.uid()));
create policy "teacher deletes own classroom" on public.classrooms for delete to authenticated
 using(teacher_id=(select auth.uid()));

create policy "teacher adds students" on public.students for insert to authenticated
 with check(private.is_teacher(classroom_id));
create policy "teacher guardian student visibility" on public.students for select to authenticated
 using(private.is_teacher(classroom_id) or private.is_guardian_student(id));
create policy "teacher deletes students" on public.students for delete to authenticated
 using(private.is_teacher(classroom_id));

create policy "teacher and linked guardian read link" on public.guardian_links for select to authenticated
 using(private.is_teacher(classroom_id) or guardian_id=(select auth.uid()));

create policy "teacher reads invitations" on public.invitations for select to authenticated
 using(private.is_teacher(classroom_id));
create policy "teacher creates invitations" on public.invitations for insert to authenticated
 with check(private.is_teacher(classroom_id) and private.student_in_class(student_id,classroom_id)
 and expires_at>now() and expires_at<now()+interval '15 days' and used_at is null);

create policy "teacher and targeted guardian read assignments" on public.assignments for select to authenticated
 using(private.is_teacher(classroom_id) or
  (student_id is null and private.is_guardian_class(classroom_id)) or
  (student_id is not null and private.is_guardian_student(student_id)));
create policy "teacher creates assignments" on public.assignments for insert to authenticated
 with check(private.is_teacher(classroom_id) and (student_id is null or private.student_in_class(student_id,classroom_id)));
create policy "teacher edits assignments" on public.assignments for update to authenticated
 using(private.is_teacher(classroom_id)) with check(private.is_teacher(classroom_id) and (student_id is null or private.student_in_class(student_id,classroom_id)));
create policy "teacher removes assignments" on public.assignments for delete to authenticated
 using(private.is_teacher(classroom_id));

create policy "teacher and guardian read released results" on public.results for select to authenticated
 using(private.is_teacher(classroom_id) or (released_at is not null and private.grades_visible(classroom_id) and private.is_guardian_student(student_id)));
create policy "teacher enters results" on public.results for insert to authenticated
 with check(private.is_teacher(classroom_id) and private.student_in_class(student_id,classroom_id) and private.assignment_ok(assignment_id,classroom_id,student_id));
create policy "teacher changes results" on public.results for update to authenticated
 using(private.is_teacher(classroom_id))
 with check(private.is_teacher(classroom_id) and private.student_in_class(student_id,classroom_id) and private.assignment_ok(assignment_id,classroom_id,student_id));

create policy "teacher or linked recipient reads messages" on public.messages for select to authenticated
 using(private.is_teacher(classroom_id) or
 (kind='announcement' and private.is_guardian_class(classroom_id)) or
 (kind='direct' and private.is_guardian_student(student_id) and (sender_id=(select auth.uid()) or recipient_id=(select auth.uid()))));
create policy "authorized senders insert messages" on public.messages for insert to authenticated
 with check(sender_id=(select auth.uid()) and
 (
 (kind='announcement' and private.is_teacher(classroom_id))
 or (kind='direct' and private.is_teacher(classroom_id) and private.guardian_target(classroom_id,student_id,recipient_id))
 or (kind='direct' and private.is_guardian_student(student_id)
     and private.student_in_class(student_id,classroom_id)
     and private.is_teacher_uid(classroom_id,recipient_id)
     and private.parent_replies_allowed(classroom_id))
 ));

create policy "teacher reads attempts guardian reads own" on public.practice_attempts for select to authenticated
 using(private.is_teacher(classroom_id) or (guardian_id=(select auth.uid()) and private.is_guardian_student(student_id)));
create policy "guardian submits practice only" on public.practice_attempts for insert to authenticated
 with check(guardian_id=(select auth.uid()) and private.is_guardian_student(student_id)
  and private.student_in_class(student_id,classroom_id)
  and private.assignment_ok(assignment_id,classroom_id,student_id));

-- The one-time, email-bound invite claim runs in private schema, never exposed directly.
-- Only an authenticated user with the matching verified auth email may claim the code.
create or replace function private.claim_invite_internal(p_code text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare i public.invitations%rowtype; v_email text;
begin
 if (select auth.uid()) is null then raise exception 'Sign in required'; end if;
 if length(p_code)<16 or length(p_code)>80 then raise exception 'Invitation is invalid or expired'; end if;
 v_email:=lower(coalesce((select auth.jwt()->>'email'),''));
 select * into i from public.invitations
 where token_hash=encode(pg_catalog.sha256(pg_catalog.convert_to(lower(pg_catalog.btrim(p_code)),'UTF8')),'hex')
   and expires_at>now() and used_at is null for update;
 if not found or lower(i.email)<>v_email then raise exception 'Invitation is invalid or expired'; end if;
 insert into public.guardian_links(classroom_id,student_id,guardian_id,guardian_email)
 values(i.classroom_id,i.student_id,(select auth.uid()),v_email)
 on conflict(student_id,guardian_id) do nothing;
 update public.invitations set used_at=now() where id=i.id;
 return jsonb_build_object('ok',true);
end;
$$;
revoke all on function private.claim_invite_internal(text) from public,anon;
grant execute on function private.claim_invite_internal(text) to authenticated;

create or replace function public.claim_invitation(p_code text) returns jsonb
language sql security invoker set search_path = ''
as $$ select private.claim_invite_internal(p_code) $$;
revoke all on function public.claim_invitation(text) from public,anon;
grant execute on function public.claim_invitation(text) to authenticated;

-- Private file bucket. Never make public. 5 MB/file and safe content types only.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('teacher-assignments','teacher-assignments',false,5242880,
 array['application/pdf','image/png','image/jpeg','image/webp','text/plain'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "classroom teacher uploads private file" on storage.objects for insert to authenticated
 with check(bucket_id='teacher-assignments' and private.is_teacher(
 case when (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' then (storage.foldername(name))[1]::uuid else null end));
create policy "teacher or matching guardian reads private file" on storage.objects for select to authenticated
 using(bucket_id='teacher-assignments' and
 (private.is_teacher(case when (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' then (storage.foldername(name))[1]::uuid else null end)
  or exists(select 1 from public.assignments a where a.attachment_path=name
    and private.guardian_has_assignment(a.id))));
create policy "teacher removes private file" on storage.objects for delete to authenticated
 using(bucket_id='teacher-assignments' and private.is_teacher(
 case when (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$' then (storage.foldername(name))[1]::uuid else null end));

-- SECURITY TODO before real-world use: automatic retention/deletion, abuse throttling,
-- policies verified against direct API requests, parent/teacher identity verification,
-- district data-processing agreements and jurisdiction-specific review.
