DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Block direct inserts"
  ON public.notifications FOR INSERT
  WITH CHECK (false);