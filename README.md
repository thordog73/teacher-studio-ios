# Teacher Studio — Build 12: Family Desk (iOS source 1.2.0)

**Remember Why You Teach.** Build 12 adds a **Today** home for families and an action queue for teachers. It organizes routine questions, dated attendance and dismissal requests, callbacks, announcements and editable FAQs while retaining Family Connect, lesson tools, fraction practice, released-grade controls and teacher-owned encrypted backups.

## Upload this build from Windows

Extract the complete ZIP into any folder, then double-click **UPDATE.cmd**. From Command Prompt opened in that folder, the only command is:

```cmd
UPDATE.cmd
```

The included launcher finds its own folder, downloads the current `main` branch of **thordog73/teacher-studio-ios** into a temporary working folder, copies the files listed in `UPDATE-FILES.txt`, commits the update when needed and pushes it to the same repository. Existing Git history is retained. It opens Codemagic after a successful upload; select **main → ios-testflight** to start the signed build.

Git for Windows must already be available, as with the other app upload commands. Git may use its normal sign-in prompt. Dependency installation, tests and iOS compilation run in Codemagic. The launcher stops if a required step fails and leaves the temporary checkout available for diagnosis.

The release file list prevents unrelated files placed next to the app from being swept into the update. Keep the complete extracted package together; the launcher checks that the listed files are present before it uploads anything.

## Open the offline demo

Open `standalone-demo.html` from this source package in a browser. The separately supplied file `teacher-studio-build12-demo.html` contains the same application. A phone's file-preview window may display the file without running it; open it in a browser that supports local HTML, or serve `web/` through localhost/HTTPS.

1. Start on **Today** as the teacher and explore the queue.
2. Switch to **Parent** and select the linked fictional child. Open a quick topic or FAQ.
3. Request a change for a specific dismissal date. The confirmed plan stays visible while the request is pending.
4. Switch back to the teacher to review the practice request and try the callback and announcement workflows.
5. Use **All teacher tools** to reopen the existing classroom, math, materials and backup features.

The role switch is a one-device demonstration, not authentication. Use fictional children, families, contact details and school procedures. A new Family Desk request is saved locally: another device does not receive it, and a practice review is not a real school approval.

## What changed

- **A simpler daily home:** a selected child, the relevant date, the confirmed dismissal plan and requests needing attention.
- **A teacher action queue:** an explicit next action and owner, with waiting and resolved work distinguished from new messages.
- **Dated dismissal practice:** a usual plan plus date-specific exceptions; pending changes do not silently replace the confirmed plan.
- **Pickup verification practice:** recording an intended adult or a code is separate from checking that the adult is authorized.
- **Callbacks:** direction, attempts, voicemail, reaching someone and resolution are distinct states. The phone indicator has a text label.
- **Announcements and FAQs:** audience and required response are explicit; reading a notice is different from acknowledging it. Editable answers lead to the relevant action.

Details and practical review scenarios are in `docs/BUILD_12_FAMILY_DESK.md`.

## Existing connected Family Connect pilot

The multi-file source retains the optional Supabase account, invitation, assignment, released-grade and messaging features from Build 11. **The new Family Desk operational requests have no remote delivery or school approval service in this build.** Configuring the existing connected pilot does not turn those new local practice records into shared operational records.

For a fictional two-device test of the existing Family Connect features:

1. Create an isolated Supabase project and run `supabase/schema.sql`, then `supabase/migrate_build11_guardian_revocation.sql`. An older database may also need the existing `migrate_v7_release_gate.sql`; the current schema already includes that release gate.
2. Configure email OTP and test accounts. Use the exact fictional guardian email that the teacher invited, with a separate teacher account.
3. Set `TEACHER_STUDIO_SUPABASE_URL` and `TEACHER_STUDIO_SUPABASE_PUBLISHABLE_KEY` in the build environment, or use the multi-file app's settings. Only the public URL and public publishable/anon key belong in the client. Keep private service keys and signing credentials outside the app.
4. Create a fictional classroom, student and email-bound invitation. Copy or share the invitation through a channel you choose; the app does not deliver invitation email automatically.
5. Follow `PILOT_SECURITY_TESTS.md` for the existing cross-account release and revocation checks. The standalone HTML always stays in demo mode, even if its browser has saved connected settings.

The connected client fetches messages on opening or **Refresh**; there is no background push delivery. The source package is for fictional testing and has not been validated for real student records.

## Build and local verification

```bash
npm install --no-fund --no-audit
npm run test
npm run test:package
npm run build:standalone
npm run build
```

- `npm run test` runs the inherited math, cloud mock, encryption, native-share and family-visibility tests, followed by the new communication model and UI tests.
- `npm run test:communication` runs just the new communication tests.
- `npm run test:package` checks the Today hook, ordered assets, service-worker asset list, app identity, retained iOS workflow and complete, safe Windows update file entries.
- `npm run build:standalone` regenerates `standalone-demo.html` directly from `web/index.html`, inlining local CSS and scripts in order. It requires no dependency installation and includes the browser native-sharing stub.
- `npm run build` creates `www/` and bundles the existing Capacitor Filesystem/Share bridge locally. No CDN is needed at runtime.

Source tests and a web build do not establish that an Apple build has compiled or that a native share completed on an iPhone. Historical Python smoke scripts target older screens; the Build 12 communication tests are the current Family Desk gate.

## iPhone / TestFlight source

The app identifier remains **`com.frontofus.teacherstudio`**. Both native preparation helpers read **1.2.0** from `package.json` and retain the dynamic build number. Capacitor dependencies, iOS sharing configuration, workflow names and Apple publishing settings are preserved.

The **20 October iOS build correction** explicitly generates a CocoaPods project for the existing Xcode workspace commands. Both workflows stop when a required command fails, and Pod installation runs in its own directory without moving the following privacy step out of the repository root. This corrects the reported missing `Podfile` and cascading privacy-script path error.

- `ios-compile-check` creates and compiles an unsigned iOS Simulator application on a Codemagic macOS builder.
- `ios-testflight` uses the existing `TeacherStudioASC` integration and signing configuration to archive and submit to TestFlight when run in the configured account.

Follow `TESTFLIGHT_STEPS_WINDOWS.md` for the existing pipeline setup. This package contains source and an offline HTML demo; no signed `.ipa`, physical iPhone validation or TestFlight upload is claimed.

## Files and preserved behavior

- `web/communication-model.js`, `web/communication.js`, `web/communication.css` and `web/faq-seed.js` — Family Desk practice state, views and starter FAQs.
- `web/family.js`, `web/cloud.js` and `supabase/` — retained Family Connect pilot and server access rules.
- `web/storage.js` and `scripts/native-bridge.mjs` — retained teacher-material encryption, restore and native sharing.
- `docs/BUILD_12_FAMILY_DESK.md` — workflow descriptions and known boundaries.

Teachers still choose when to release individual grades. Teacher-owned backup files retain the existing encrypted `.tsbackup` format and exclude student records; they do not back up the new family communication practice records. Saving or sharing a backup does not by itself confirm that an off-device copy exists.
