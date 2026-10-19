# Build 8 — Local-first storage architecture

## Intent

Minimize running costs while giving educators ownership and portability of **teacher-created content**. Distinguish that from **student records and private family communication**, which require separate authorization, retention, audit and secure synchronization.

## Data classes

1. **Teacher-owned materials:** personal files, own lessons, portable curriculum, favorites, teaching philosophy. Build 8 personal vault is allowed to store these; encrypted files can be exported to an educator-selected cloud account.
2. **Locally curated classroom/public drafts:** School Hub resources and FAQ, fictional showcase snapshots. A user may opt to back up these drafts, after reviewing the content for personal-data restrictions. Publishing remains separate.
3. **Sensitive school records:** student names, photos of children, assignments submitted by students, grades, parent account identifiers, messages, behavior notes, attendance. Explicitly excluded from Build 8 personal backups. No cloud sync for these until independently reviewed and district authorized.

## Backend cost

Build 8 personal vault and offline practice need no developer-operated storage server. Optional Supabase connectivity from previous versions is a *separate experimental feature* and cannot rely on local device data as an automatically synchronized source.

## Restoring

The `.tsbackup` file has a plaintext magic/version header and PBKDF2 salt + parameters, followed by authenticated encrypted manifest and per-file encrypted chunks. Restore first decrypts and authenticates all records into a separate IndexedDB staging store, then replaces the primary personal vault in a transaction. It uses allowlisted keys for optional teacher-authored drafts; no demographic/gradebook/student demo data is included. A reload is required for previously initialized app modules.

The current code is a **browser prototype**, not a complete transactional backup of every Teacher Studio module. Existing Classroom Page photos and artwork, student score/messaging databases, lesson scans, and online storage are not part of this file. A teacher who needs student data recovery must use a school-authorized system.

## Future enhancements

- Native iOS/Android app-managed documents database and file-provider integration.
- Device and browser testing for storage quotas, eviction, large backup streaming and passphrase recovery expectations.
- Better backup selection by module and backup manifests listing exact content categories before export.
- School-owned records on a separate compliant server with guardian verification, retention and deletion workflows.
- Optional auto backup using scoped OAuth access to teacher-chosen storage account (an explicit opt-in; no access to an entire cloud drive by default).
