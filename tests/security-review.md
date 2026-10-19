# Teacher Studio — mandatory preproduction security review

This is a test plan, **not proof of security**. Carry it out in a separately provisioned Supabase test project using fictional data and at least four test accounts. Perform independent security review before any live student records are created.

## Distinct fictional accounts

- Teacher A, Classroom A, students A1 and A2.
- Parent A (guardian invited for student A1 only).
- Parent B (guardian invited for student A2 only).
- Uninvited user C with no guardian link.
- Teacher B in separate Classroom B, Student B1.

## Authorization acceptance tests

1. Authenticate all users using the correct email OTP. Parent A must see student A1 only and never the classroom roster of other students.
2. Parent A must not read student A2 via guessed `students?id=eq...` or by modifying browser fetch requests.
3. Parent A must not read any teacher-recorded results while the classroom's `share_grades` flag is false, including through a direct REST query.
4. When `share_grades` is enabled, Parent A may access only student A1 grades; Parent B may access only student A2 grades.
5. Parent A may read classwide assignments and specifically A1 assignments; not A2-only assignment or attachment bytes.
6. Parent A cannot insert or update official `results` via REST or PostgREST; only teacher may change official results.
7. Parent A may insert practice attempts only for linked student A1 and a visible assignment, and the attempt must remain labeled self-scored.
8. Parent A must not read or insert private messages involving Parent B. Teacher A may read messages within Classroom A only.
9. When teacher disables replies, Parent A's direct message INSERT must fail at the database layer.
10. Uninvited user C must not read classrooms, student rows, assignments, attachments, messages or grades.
11. Teacher B must not read or alter Classroom A records; Teacher A must not access Classroom B.
12. Wrong, expired, already-used, or email-mismatched invite tokens must fail. The token must not be stored in plaintext in the database.
13. A guardian must never join based only on a generic class code; each invitation must match the authenticated guardian email and intended student.
14. Parent A must not upload, overwrite or delete any teacher's storage files through the Storage API.
15. File reads must be checked through the direct Storage API, including guessed keys, not just by hiding a download button.
16. Authenticated requests with arbitrary `teacher_id`, `guardian_id`, `classroom_id` and `sender_id` supplied by the client must be rejected by RLS unless valid.
17. Ensure `anon` cannot SELECT/INSERT/UPDATE any protected database table or call invite-claim procedures.
18. Test logout and expired/rotated session tokens; no leakage of private content across accounts on shared devices.
19. Test HTML/script injection attempts through assignment titles, directions, message bodies and student display names.
20. Test data export/deletion, orphaned storage cleanup, backups, monitoring, rate limits, contact/abuse support and data retention.

## Beyond authorization

Get a qualified privacy/security review for school procurement, FERPA, COPPA, applicable state laws, international transfer requirements, educator/guardian authentication, DPA, breach notification, retention, access audit trails, account recovery, content moderation and child accessibility. Conduct SAST/DAST and suitable third-party penetration testing where required.

**Critical product caveat:** a parent receiving an invitation code at a specified email address is not, by itself, legal evidence that the person may access that student's educational record. The school must verify authorized guardians before issuing invitations.
