# Classroom pages — server-side design (NOT YET IMPLEMENTED)

## Roles and scope

- **School editor**: authoritative school contact information and school calendar only, if school-approved.
- **Teacher**: can create and edit personalized class pages for classrooms they own (or are authorized co-teachers for). School cannot assume teacher ownership simply from a classroom name.
- **Verified guardian**: reads published pages of classes to which their children are enrolled AND reads student-specific media only when the guardian link matches the media's allowed student scope.
- **Student**: can view assigned public-to-class content and their own work if school approved.
- **Guest**: no classroom information, student photos, artwork or messages unless separately designated as explicitly public, reviewed and authorized. No public visibility in the MVP.

## Model

`schools (id, verified_owner)`
`classrooms (id, school_id, teacher_id)`
`classroom_pages (classroom_id, draft_json, published_json, published_at)`
`classroom_media (id, classroom_id, storage_path, uploader_id, visibility, student_id, consent_record, status, created_at)`
`classroom_events (id, classroom_id, title, date, published)`
`guardian_links (guardian_id, student_id, classroom_id, verified_at, revoked_at)`

Guardians may not authorize themselves to view a student just by possessing a class join link. Invitation must be identity-bound, expiring, revocable, and teacher/school confirmed.

## RLS and storage

- Enforce authorization **server side** on every database and file request; hiding UI panels is not access control.
- Teacher writes require `classroom.teacher_id = auth.uid()` or an authorized co-teacher link.
- Guarded gallery reads require a verified `guardian_links` row for the specific classroom, and either `visibility=class` with consent approved, or `visibility=student` with matching student ID and consent approved.
- Parent-facing pages always read `published_json`, never `draft_json`.
- Images use private object storage with short-lived, role-gated access, compression/EXIF stripping, content and file limits, malware screening appropriate to risk, and school-approved retention.
- Use deletion/revocation actions and activity auditing. Do not expose raw storage paths or allow hotlinking private media.
- Collect minimal information. Distinguish teacher-controlled classroom announcements from student work/education records.

## Operational burden

Cloud photo storage and communication are not guaranteed to remain free. Any production launch requires a sustainable plan for moderation, privacy requests, support, encryption, uptime, backups, and secure software updates. Do not present current demo publishing as production-safe sharing.
