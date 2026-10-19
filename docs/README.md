# Teacher Studio — Build 9

**Remember Why You Teach.** An offline-first, human-led teaching toolkit and fictional connected-classroom demonstrator. Build 9 preserves the previous teaching and family-demo tools and improves **My Storage & Backup** with a Backup Safety Center, a clearer **Send to myself / Save to Files** workflow, optional confirmation that a copy was stored outside the device, 7-day in-app reminders, and a verification-only check for an external encrypted archive.

## Try it in under a minute

1. Extract the ZIP on a computer.
2. Open `standalone-demo.html` in a modern browser. This is an all-in-one HTML file; it needs no CDN or internet connection for teaching tools.
3. Switch to **Teacher**, then select **My Storage & Backup** from the navigation.
4. Choose one of **your own, non-student teaching files**. Check the ownership/privacy confirmation and select **Save files on this device**.
5. To back up, enter a *strong passphrase of 12 or more characters* twice, confirm that the content is appropriate for personal backup, and select **Encrypt & prepare backup**.
6. Select **Send to myself / Save to Files** (or download). The iPhone sharing menu can send a small encrypted attachment through Mail or store it to iCloud Drive/Files. You must confirm delivery yourself; for large libraries use cloud Files rather than email. Choose your own iCloud Drive, Google Drive, OneDrive, external drive, or school-approved destination.
7. After you have checked the backup is outside the device, select **I saved my backup elsewhere**. Use **Verify backup without restoring** to authenticate every file chunk in the saved archive. To test restoration on a spare browser profile, open **Restore my teaching library**, select your `.tsbackup` file, enter the passphrase, and confirm replacement. **Keep the original backup until you check the restored data.**

The app **never sends the local library or encrypted backup to our servers**. Download/share is a deliberate user action. Automatic cloud upload and synchronization have *not* been implemented. For iPhone, saving a downloaded file to the Files app and its iCloud Drive location depends on the actual browser/iOS integration.

## Why is this inexpensive?

The original teaching resources and personal file library are kept by the user's own browser/device. Storage is charged to the device, not a Teacher Studio backend. The proposed **1 GB** is only a *usage target*, not an allocation, guarantee or quota; capacity depends on browser/OS and free disk space. `navigator.storage.estimate()` reports approximate total origin usage, which can include cached scripts and data from other Teacher Studio tools.

The current browser-based build uses **IndexedDB**, which is best-effort storage and can be evicted. Press **Ask device to protect storage** to request persistent storage where supported, and always keep independent encrypted backups. The eventual App Store build should migrate the personal library to app-managed document storage rather than rely on browser database persistence alone.

The free standalone HTML works on many computers. For a PWA install, use `index.html` over `https://` or local HTTP (e.g. `python -m http.server 8000` from this directory). Service workers generally cannot install when opening `file://` HTML. On iPhones, opening a ZIP's HTML in Files/Quick Look may not preserve browser storage reliably; a properly hosted PWA or packaged native application is preferable for serious use.

## What's included in a Build 8 backup

| Included | Not included |
|---|---|
| Files uploaded to the new personal file library | Classroom/student rosters, student IDs, official grades and diagnostic attempts |
| Optional: teacher-authored Classroom Kits | Private family messages or guardian links |
| Optional: lesson exchange drafts and their original attached PDFs/TXT/DOCX | Scanned homework, student tests, reviews or behavior records |
| Optional: lesson remixes and teaching philosophy / Remember Why notes | The old My Classroom Page photos, artwork, and gallery media |
| Optional: teacher showcase drafts, restored as **unpublished** | Supabase online database/files or account sign-in settings |
| Optional: School Hub links, school resources and announcements (as locally drafted) | Automatic sync/backups to iCloud/Drive/OneDrive |

Only select the optional draft backup if it is appropriate to copy all included teacher-created content into a *personal* storage account. **Never include identifiable student records without school authorization and controls.** The personal library is not password-locked while it sits on the device; only the exported `.tsbackup` is encrypted.

## Encryption design

- Local Web Crypto: **PBKDF2-HMAC-SHA-256 with 250,000 iterations and random 16-byte salt**, deriving a 256-bit key.
- **AES-256-GCM**, with fresh independent 12-byte initialization vectors for the encrypted manifest and each 512 KiB file chunk.
- File names, teacher-draft metadata and file content are encrypted; only format/version and key derivation information remain in the outer header.
- Restore verifies the manifest and all file chunks *before* changing the primary personal file database. It stages verified files and swaps the local library within a single IndexedDB transaction. Optional teacher drafts are also restored with a best-effort rollback if the database swap fails. Existing Lesson Exchange attachments are relinked separately where possible.
- If the passphrase is lost, there is **no developer recovery**. Wrong passwords, altered chunks and incomplete files are rejected; this is not a security audit of all platforms and data-handling paths.
- Prototype max individual item size: **60 MB**; total encrypted backup size is limited to **1.2 GB**. Memory, disk, and export support may be substantially lower on mobile devices.

## Build 7 and earlier tools remain

Classroom Kit, fractions/visual lab, worksheets, deterministic auto-grading, saved kits, diagnostic/retest, Teach It Better, Teacher Showcase, Remember Why, School Hub, resources, lesson exchange, Scan & Review, fictitious grade-release workflow, and the optional Supabase backend starter files remain. The backed-up personal library does **not** become an authenticated live family network.

## Safety and release status

**Development prototype only.** Do not enter real student names, grades, identifiable artwork, personal messages, student tests or school-controlled education records. The fictional Parent role switch is a UI demonstration—not actual identity verification. No backend security audit, school approval, App Store packaging, native iCloud backup, or independent accessibility/privacy review has occurred.

Backups made from `file://` browser storage may not reopen on the same logical origin if the HTML file is moved. Use encrypted exports before upgrading or moving devices. On restore, reload the app to rehydrate teacher modules that cached state at startup.

## Testing

Tested with Chromium-based UI smoke tests and a Node Web Crypto + mock IndexedDB integration test:

```bash
node tests/math.test.js
node tests/cloud.test.js
node tests/storage-crypto.test.cjs
python tests/storage-ui-smoke.py
python tests/ui-smoke.py
python tests/connection-smoke.py
python tests/hub-smoke.py
python tests/space-smoke.py
python tests/growth-smoke.py
python tests/evolution-smoke.py
python tests/showcase-smoke.py
python tests/standalone-smoke.py
```

The `storage-crypto.test.cjs` suite uses actual Node Web Crypto with independent mocked IndexedDB transactions; it is not a replacement for running restore tests in actual mobile Safari or a native iOS app. The `storage-ui-smoke.py` suite checks UI layout and nav in a limited browser-test context; it does not exercise real browser persistence.

## Next iteration

Build 9 should focus on an actual native iPhone storage bridge or authenticated PWA origin, verified restore on iOS and Android devices, selective teacher-owned cloud sync with user-granted permissions, and a separate school-governed student data partition. The public production offering should only launch after real-device, accessibility, security, legal and teacher testing.

For the newest recovery workflow, see **BACKUP_SAFETY.md**. This is a prototype; it does not eliminate all data-loss risk and does not yet integrate native iPhone automatic backups.
