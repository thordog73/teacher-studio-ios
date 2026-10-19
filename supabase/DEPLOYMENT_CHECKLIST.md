# Connected Classroom — Pre-deployment checklist

**This is a fictional-data development pilot, not approved educational-record hosting.** It will require an independent privacy, architecture and security review before real student records, photos, grades or messages are entered.

## 1. Isolate the pilot
- Create a **new, separate Supabase project** with fictional names and test emails. Never reuse any production school project.
- Turn on appropriate identity verification, restrict sign-ups to authorized testers, and configure an approved transactional email service for magic-link/OTP verification. Never publish service-role keys or database secrets in browser code.
- In the SQL editor, run `schema.sql` for an empty project. For an existing project created with the earlier supplied `schema.sql`, review and run **only** `migrate_v7_release_gate.sql` first. Take a backup and apply migration in a test project before any later production consideration.
- Use the Supabase **publishable/anon** key (never a secret/service-role key) in Teacher Studio's Settings, together with the URL.
- Use localhost/HTTPS for sign-in and invite code hashing; standalone `file://` mode is for the offline demonstration.

## 2. Mandatory access-control tests before even a limited external pilot
With a teacher account, guardian A linked to synthetic student A, guardian B linked to synthetic student B, and an unlinked user:
1. Confirm each guardian can list only assigned classrooms and their own child's records.
2. Before teacher release, both guardians receive **zero** private `results` rows via direct REST queries, even if the UI is bypassed.
3. After releasing synthetic student A's result and enabling class grade sharing, guardian A sees A's result; guardian B and the unlinked user must not see it.
4. Disable class-wide `share_grades` and verify A no longer receives released grades.
5. Re-enable sharing, **revoke** that individual result, verify it disappears; edit that result and confirm it remains a draft until explicit reapproval.
6. Try to insert/patch `results.released_at` as guardian A. The service must reject both operations; teacher actions should succeed only for their own class.
7. Verify direct messages cannot be read by another guardian or unrelated teacher; try to forge an `sender_id` different from the authenticated user.
8. Verify teacher/guardian invitation codes are email-bound and single-use, protect against brute force, test expired codes and link revocation.
9. Verify uploaded attachments are private and downloadable only when authorized, including after assignment deletion and access revocation.
10. Verify SQL has RLS enabled for all relevant tables and storage. Review the database functions and privilege grants manually.

**Automated local browser tests do not perform the above cross-account live RLS tests.** Do not treat browser preview tests or mocked REST tests as security certification.

## 3. School compliance and operations
- Get written school/district authorization and appropriate data-protection terms; address applicable FERPA, COPPA, state laws, student-image permissions and records retention.
- Arrange guardian identity verification, account-recovery, audit logging, security monitoring, moderation, content takedown, deletion requests, backup/restore and breach response.
- Validate accessibility, multiple students/guardians per family, custody restrictions, classroom transfers, and teacher departure.
- Require teacher approval before publishing scores or student-specific information; no AI-authored sensitive messages without teacher review.
- Estimate recurring hosting, storage, email delivery and support expense. **Free tiers are not a reliability guarantee.**

## 4. Next engineering steps
- Replace simulated Teacher/Parent role toggle in cloud mode with session-bound roles derived from server-side permissions. Never trust UI role state.
- Improve API query scoping, pagination, file retention, and delete/revoke operations.
- Add rate limiting, audit events, tests against an actual isolated Supabase project, and school privacy review.
- Only after these steps, consider inviting real users.
