-- BUILD 7 MIGRATION: Apply only AFTER reviewing this SQL on a separate fictional-data project.
-- This immediately conceals previously saved grades from guardians until individually released.
-- Stop real data usage; no authorization to handle real student records is implied.
BEGIN;
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS released_at timestamptz;
DROP POLICY IF EXISTS "teacher and guardian read released results" ON public.results;
CREATE POLICY "teacher and guardian read released results" ON public.results FOR SELECT TO authenticated
USING (
 private.is_teacher(classroom_id)
 OR (released_at IS NOT NULL AND private.grades_visible(classroom_id)
     AND private.is_guardian_student(student_id))
);
COMMIT;
-- Verification required: use TWO DISTINCT test guardian accounts + teacher.
-- Guardian A must not see guardian B's records, drafts, or revoked results;
-- guardian A must be blocked from writing released_at via PostgREST.
-- Verify class-wide share_grades false hides ALL released results.
