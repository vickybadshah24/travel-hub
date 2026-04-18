-- Trigger: notify on group invite
CREATE OR REPLACE FUNCTION public.notify_on_group_invite()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type, group_id, invite_id)
  VALUES (NEW.invitee_id, NEW.inviter_id, 'group_invite', NEW.group_id, NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_group_invite
AFTER INSERT ON public.group_invites
FOR EACH ROW EXECUTE FUNCTION public.notify_on_group_invite();

-- Trigger: notify all group admins on join request
CREATE OR REPLACE FUNCTION public.notify_on_join_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type, group_id, request_id)
  SELECT gm.user_id, NEW.user_id, 'join_request', NEW.group_id, NEW.id
  FROM public.group_members gm
  WHERE gm.group_id = NEW.group_id AND gm.role IN ('owner','admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_join_request
AFTER INSERT ON public.group_join_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_on_join_request();

-- Trigger: handle join request status change (approved -> add member + notify)
CREATE OR REPLACE FUNCTION public.handle_join_request_response()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (NEW.group_id, NEW.user_id, 'member')
    ON CONFLICT (group_id, user_id) DO NOTHING;

    INSERT INTO public.notifications (user_id, actor_id, type, group_id, request_id)
    VALUES (NEW.user_id, COALESCE(NEW.responded_by, NEW.user_id), 'request_approved', NEW.group_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_handle_join_request_response
AFTER UPDATE ON public.group_join_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_join_request_response();

-- Trigger: handle invite acceptance (auto-add member)
CREATE OR REPLACE FUNCTION public.handle_invite_response()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (NEW.group_id, NEW.invitee_id, 'member')
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_handle_invite_response
AFTER UPDATE ON public.group_invites
FOR EACH ROW EXECUTE FUNCTION public.handle_invite_response();

-- Add unique constraint on group_members to support ON CONFLICT
ALTER TABLE public.group_members ADD CONSTRAINT group_members_group_user_unique UNIQUE (group_id, user_id);