# Build 8 — October 2026

- Preserves all Build 7 teaching, classroom, school hub, math, family demo, showcase and visual lesson workflows.
- Adds **My Storage & Backup** teacher-only workspace with local IndexedDB file storage, category tags, download/delete and usage meter.
- Adds optional browser persistent-storage request.
- Adds encrypted `.tsbackup` export and authenticated pre-restore validation.
- Backup contains local teacher-owned files, and optionally teacher-authored saved kits, lesson drafts, favorite links, and lesson exchange attachments.
- Excludes fictional/real student roster, results, messaging, scanned work and existing Classroom Page images.
- Adds Share/Save to Files where browser supports native file sharing; manual download works without a cloud account.
- Restores backups into IndexedDB staging, validates every AES-GCM chunk, then commits the local vault and eligible teacher drafts.
- This is not automatic cloud backup or native iOS file storage.
