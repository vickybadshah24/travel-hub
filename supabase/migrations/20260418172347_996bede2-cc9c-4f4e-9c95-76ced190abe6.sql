
-- ============ ENUMS ============
create type public.group_role as enum ('owner', 'admin', 'member');
create type public.group_privacy as enum ('public', 'private');
create type public.conversation_type as enum ('direct', 'group');

-- ============ GROUPS ============
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  cover_url text,
  privacy public.group_privacy not null default 'public',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null,
  role public.group_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create index idx_group_members_user on public.group_members(user_id);
create index idx_group_members_group on public.group_members(group_id);

-- Security definer function to check membership without recursion
create or replace function public.is_group_member(_group_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = _group_id and user_id = _user_id
  )
$$;

create or replace function public.is_group_admin(_group_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = _group_id and user_id = _user_id
      and role in ('owner','admin')
  )
$$;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Groups RLS
create policy "Public groups are viewable by everyone"
  on public.groups for select
  using (privacy = 'public' or public.is_group_member(id, auth.uid()));

create policy "Authenticated users can create groups"
  on public.groups for insert
  with check (auth.uid() = created_by);

create policy "Group admins can update group"
  on public.groups for update
  using (public.is_group_admin(id, auth.uid()));

create policy "Group owners can delete group"
  on public.groups for delete
  using (exists (
    select 1 from public.group_members
    where group_id = groups.id and user_id = auth.uid() and role = 'owner'
  ));

-- Group members RLS
create policy "Members visible to group members or if group is public"
  on public.group_members for select
  using (
    public.is_group_member(group_id, auth.uid())
    or exists (select 1 from public.groups g where g.id = group_id and g.privacy = 'public')
  );

create policy "Users can join groups themselves"
  on public.group_members for insert
  with check (auth.uid() = user_id);

create policy "Users can leave groups themselves"
  on public.group_members for delete
  using (auth.uid() = user_id);

create policy "Admins can manage memberships"
  on public.group_members for update
  using (public.is_group_admin(group_id, auth.uid()));

-- Auto-add creator as owner
create or replace function public.handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

-- ============ LIKES ============
create table public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index idx_post_likes_post on public.post_likes(post_id);
create index idx_post_likes_user on public.post_likes(user_id);

alter table public.post_likes enable row level security;

create policy "Likes viewable by everyone"
  on public.post_likes for select using (true);

create policy "Users can like posts"
  on public.post_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can unlike their likes"
  on public.post_likes for delete
  using (auth.uid() = user_id);

-- ============ COMMENTS ============
create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null,
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index idx_post_comments_post on public.post_comments(post_id);

alter table public.post_comments enable row level security;

create policy "Comments viewable by everyone"
  on public.post_comments for select using (true);

create policy "Users can comment"
  on public.post_comments for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own comments"
  on public.post_comments for delete
  using (auth.uid() = user_id);

create policy "Users can update own comments"
  on public.post_comments for update
  using (auth.uid() = user_id);

-- ============ CONVERSATIONS ============
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  type public.conversation_type not null,
  group_id uuid references public.groups(id) on delete cascade,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique (group_id)
);

create table public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  unique (conversation_id, user_id)
);

create index idx_conv_part_user on public.conversation_participants(user_id);
create index idx_conv_part_conv on public.conversation_participants(conversation_id);

create or replace function public.is_conversation_participant(_conv_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = _conv_id and user_id = _user_id
  )
  or exists (
    select 1 from public.conversations c
    join public.group_members gm on gm.group_id = c.group_id
    where c.id = _conv_id and gm.user_id = _user_id
  )
$$;

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;

create policy "Conversations visible to participants"
  on public.conversations for select
  using (public.is_conversation_participant(id, auth.uid()));

create policy "Authenticated users can create conversations"
  on public.conversations for insert
  with check (auth.uid() = created_by);

create policy "Participants visible to participants"
  on public.conversation_participants for select
  using (public.is_conversation_participant(conversation_id, auth.uid()));

create policy "Users can add themselves or be added by creator"
  on public.conversation_participants for insert
  with check (
    auth.uid() = user_id
    or exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = auth.uid())
  );

create policy "Users can update own participation"
  on public.conversation_participants for update
  using (auth.uid() = user_id);

create policy "Users can leave conversations"
  on public.conversation_participants for delete
  using (auth.uid() = user_id);

-- ============ MESSAGES ============
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null,
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index idx_messages_conversation on public.messages(conversation_id, created_at desc);

alter table public.messages enable row level security;

create policy "Messages visible to conversation participants"
  on public.messages for select
  using (public.is_conversation_participant(conversation_id, auth.uid()));

create policy "Participants can send messages"
  on public.messages for insert
  with check (
    auth.uid() = user_id
    and public.is_conversation_participant(conversation_id, auth.uid())
  );

create policy "Users can delete own messages"
  on public.messages for delete
  using (auth.uid() = user_id);

-- ============ FOREIGN KEYS to profiles for joins ============
alter table public.groups
  add constraint groups_created_by_profiles_fkey
  foreign key (created_by) references public.profiles(id) on delete cascade;

alter table public.group_members
  add constraint group_members_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.post_likes
  add constraint post_likes_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.post_comments
  add constraint post_comments_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.messages
  add constraint messages_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.conversation_participants
  add constraint conv_part_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- ============ REALTIME ============
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.post_likes;
alter publication supabase_realtime add table public.post_comments;
alter publication supabase_realtime add table public.group_members;
