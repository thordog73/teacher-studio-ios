# Build 12 — October 2026

- **21 October one-command TestFlight upload:** `UPDATE.cmd` now starts the existing signed Codemagic workflow immediately after the GitHub push. The included Node helper verifies the repository and commit, accepts the existing API token privately, prints the build link, and keeps nonsecret request state to avoid duplicate or uncertain retries. The signed workflow checks the uploaded commit and app identity before installing dependencies.

- **20 October iOS build correction:** both Codemagic workflows explicitly generate CocoaPods projects, check for the Podfile and stop on failed commands. Pod installation keeps its directory change in a subshell so the privacy step runs from the repository root. The privacy helper locates its own repository and uses the package version for Xcode settings.
- Packages **UPDATE.cmd** for a short Windows upload command from any extracted folder, with a release file list, a normal push to the existing GitHub repository and automatic TestFlight build initiation.

- Adds Today & families as the starting screen with Attendance, Going home, Schoolwork & grades, Dates & forms, Messages & calls, and Help & school info.
- Adds teacher follow-up views for own actions, waiting work and completed requests, ordered by requested date. The full queue keeps every item reachable.
- Adds local practice attendance, one-day dismissal, call, support and conference workflows with explicit routing and persistent status history.
- Keeps the confirmed plan while a request is pending. Verified early pickup uses one attendance request and updates only that day's plan.
- Distinguishes call attempts, voicemail, contact, follow-up and resolution. Teacher call cards show linked family callback preferences when provided.
- Reuses classroom message records, adds explicit audience and acknowledgment/reply/call requirements, and returns an answered family reply task to the teacher.
- Adds per-child and per-guardian form responses, with differing guardian responses shown to the teacher for follow-up.
- Adds thirty editable starter FAQs with actions. Shared school information and calendar entries reuse School Hub; classroom FAQ answers remain scoped and deleted starters stay deleted.
- Reuses original assignments and released grades; missing work is explicitly marked, never inferred from an absent score.
- Retains Family Connect setup, the teacher tool collection, encryption and native sharing. New family practice records remain outside teacher-material backups.
- Regenerates an offline single-file demo and keeps the existing iOS source/pipeline under version 1.2.0. No signed binary or Apple submission is included.

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
