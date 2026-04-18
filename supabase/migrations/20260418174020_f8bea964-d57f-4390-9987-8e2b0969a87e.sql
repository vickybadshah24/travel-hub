-- 1. Add geo to posts
ALTER TABLE public.posts
  ADD COLUMN latitude DOUBLE PRECISION,
  ADD COLUMN longitude DOUBLE PRECISION;
CREATE INDEX idx_posts_geo ON public.posts(latitude, longitude) WHERE latitude IS NOT NULL;

-- 2. Status enums
CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'declined');
CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'rejected');

-- 3. Group invites
CREATE TABLE public.group_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL,
  invitee_id UUID NOT NULL,
  status public.invite_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (group_id, invitee_id)
);
CREATE INDEX idx_group_invites_invitee ON public.group_invites(invitee_id, status);
CREATE INDEX idx_group_invites_group ON public.group_invites(group_id);
ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invites visible to invitee, inviter and admins"
  ON public.group_invites FOR SELECT
  USING (
    auth.uid() = invitee_id
    OR auth.uid() = inviter_id
    OR public.is_group_admin(group_id, auth.uid())
  );

CREATE POLICY "Group members can invite"
  ON public.group_invites FOR INSERT
  WITH CHECK (
    auth.uid() = inviter_id
    AND public.is_group_member(group_id, auth.uid())
  );

CREATE POLICY "Invitee can update own invite status"
  ON public.group_invites FOR UPDATE
  USING (auth.uid() = invitee_id);

CREATE POLICY "Inviter or admin can cancel invite"
  ON public.group_invites FOR DELETE
  USING (auth.uid() = inviter_id OR public.is_group_admin(group_id, auth.uid()));

-- 4. Group join requests
CREATE TABLE public.group_join_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT,
  status public.request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  responded_by UUID,
  UNIQUE (group_id, user_id)
);
CREATE INDEX idx_join_requests_group ON public.group_join_requests(group_id, status);
CREATE INDEX idx_join_requests_user ON public.group_join_requests(user_id);
ALTER TABLE public.group_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requests visible to requester and admins"
  ON public.group_join_requests FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_group_admin(group_id, auth.uid())
  );

CREATE POLICY "User can create own join request"
  ON public.group_join_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update request status"
  ON public.group_join_requests FOR UPDATE
  USING (public.is_group_admin(group_id, auth.uid()));

CREATE POLICY "User can cancel own request"
  ON public.group_join_requests FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Extend notification enum
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'group_invite';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'join_request';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'request_approved';

-- 6. Add columns to notifications for invites/requests
ALTER TABLE public.notifications
  ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  ADD COLUMN invite_id UUID REFERENCES public.group_invites(id) ON DELETE CASCADE,
  ADD COLUMN request_id UUID REFERENCES public.group_join_requests(id) ON DELETE CASCADE;

-- 7. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_join_requests;