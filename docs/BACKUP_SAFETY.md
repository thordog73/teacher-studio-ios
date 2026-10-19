# Build 9 — Backup Safety Center

## Why it exists

Keeping original teaching material on a phone is convenient but not sufficient data protection. Phones get replaced, browsers may evict databases, and users may delete applications. This version adds an off-device backup checklist around Build 8’s local encryption and file-sharing capabilities.

## Teachers’ workflow

1. Add original teacher-owned lesson files to My Storage & Backup. Do not put student records into personal backups.
2. Select **Encrypt & prepare backup**, supply a separate 12+ character passphrase (which the application cannot recover), then select **Send to myself / Save to Files**.
3. On iPhone, choose **Save to Files** and a synced **iCloud Drive** folder, another account like Google Drive/OneDrive, or Mail if the encrypted file is small enough for the email provider’s attachment limits. The app cannot programmatically ensure it was sent or saved. No `mailto:` file attachment hack is used.
4. Check that the encrypted file exists outside the phone, then choose **I saved my backup elsewhere**. This stores only a date, destination description, a local change-indicator fingerprint and filename—not the email address, passphrase or data itself. It is a self-confirmation, not independent verification.
5. A weekly reminder appears upon visiting My Storage & Backup, or sooner if the local file metadata or saved teacher drafts have changed. This is **not a background notification** and it cannot guarantee backup freshness.
6. Choose **Verify backup without restoring**, select the external `.tsbackup` file, and provide the passphrase. It authenticates every encrypted chunk and checks the archive format without changing the library. On a replacement device choose **Verify & restore backup** to import.

## Technical limitations

- **No automatic cloud backup**. A future native iOS app could use eligible app-container files with the user’s device backup when iCloud Backup is enabled. The current HTML/IndexedDB implementation should not be described as automatically iCloud-backed-up.
- The backup is ciphertext. There is no passphrase recovery; loss of both device data and passphrase means recovery is not possible.
- Email attachments have size limits. Large libraries should use Files/iCloud Drive, Google Drive, or OneDrive rather than email.
- A teacher marking a backup saved is not evidence the cloud destination contains it; verification of an external copy is recommended.
- Existing Build 8 `.tsbackup` archives remain readable. No version-8 format migration is required.
- The change detector is a convenience hash of local library metadata and teacher draft text, **not** a proof of external storage or cryptographic integrity.
- The app does not export student rosters, recorded grades, parent messages, scans of student work, or existing classroom-page gallery media. Personally identifying information in text the teacher writes must still be reviewed and kept out of personal backups absent school authorization.
- Device/browser storage can be evicted, as can its backup status metadata. Back up externally and test restoration.
