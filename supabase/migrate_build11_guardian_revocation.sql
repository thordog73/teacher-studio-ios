-- BUILD 11 — exclusively for an isolated Supabase project with FICTIONAL accounts.
-- Run schema.sql first for a new project. Do NOT install on real-student data.
-- Enforces guardian revocation / pending invite cancellation through teacher-checked RPCs.
-- No extra exposure of guardian_links or invitations via Data API.
BEGIN;

CREATE OR REPLACE FUNCTION public.revoke_guardian_access(p_link_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_class uuid;
BEGIN
  SELECT g.classroom_id INTO v_class FROM public.guardian_links AS g WHERE g.id=p_link_id FOR UPDATE;
  IF v_class IS NULL OR NOT private.is_teacher(v_class) THEN
    RAISE EXCEPTION 'Access denied or guardian link unavailable';
  END IF;
  DELETE FROM public.guardian_links WHERE id=p_link_id AND classroom_id=v_class;
  RETURN jsonb_build_object('ok',true);
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_guardian_access(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.revoke_guardian_access(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_family_invitation(p_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_class uuid;
BEGIN
  SELECT i.classroom_id INTO v_class FROM public.invitations AS i WHERE i.id=p_invite_id AND i.used_at IS NULL FOR UPDATE;
  IF v_class IS NULL OR NOT private.is_teacher(v_class) THEN
    RAISE EXCEPTION 'Access denied or invitation unavailable';
  END IF;
  DELETE FROM public.invitations WHERE id=p_invite_id AND classroom_id=v_class AND used_at IS NULL;
  RETURN jsonb_build_object('ok',true);
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_family_invitation(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cancel_family_invitation(uuid) TO authenticated;
COMMIT;
