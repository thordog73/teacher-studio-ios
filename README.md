# Codemagic-ready source package — Gloria Esser Teaching Tool

**Start here:** [`UPLOAD_TO_CODEMAGIC_WINDOWS.md`](UPLOAD_TO_CODEMAGIC_WINDOWS.md). Run `python scripts/ci-preflight.py` before pushing. Codemagic workflows: `ios-compile-check` (unsigned) followed by `ios-testflight` (signed upload).

This package includes a corrected Capacitor 8 CocoaPods iOS generation command, matching bundle ID and marketing version checks, and source for Build 11. **It has not yet passed a macOS Xcode build or uploaded to TestFlight.** Its parent connection must only be tested with fictional data until backend permissions are validated.

---

# Gloria Esser Teaching Tool — Build 11: Family Connect (iOS 1.1.0)

**Remember Why You Teach.** Family Connect is the main landing screen. It helps teachers create a classroom, invite families, share homework and announcements, privately message guardians, and approve individual grade releases. Parents get a simpler view of their own linked classroom and child. The existing Gloria Esser Teaching Tool lesson tools, fractions math engine, library, portfolios, School Hub, local storage and encrypted backup features are preserved under **All teacher tools**.

## Read this first

Build 11 is a **functional offline fictional-data demo and an unconfigured source package for an optional connected Supabase pilot**. It has **not** yet been built into a signed iOS `.ipa`, installed on a real iPhone, uploaded to TestFlight, provisioned with a cloud account, tested against a live multi-account database, audited for security, or approved by a school. Never enter actual student information, parent data, real grades, student images or identifying communications. In the offline demo, the Teacher/Parent switch is **not authentication**; it only shows different mock views on the same device.

## One-minute demo

1. Open `standalone-demo.html` from the ZIP, or open `web/index.html` through localhost / HTTPS.
2. Family Connect starts with a fictional class, 20 fictional students and one sample guardian.
3. As teacher, create a **private invitation code** for a fictional email; select **Copy invite message** or **Share invitation**. No email is delivered automatically.
4. Post an announcement and a homework assignment; use **Review or enter scores** to enter and release a fictional grade.
5. Switch to **Parent** to preview only the originally linked sample child's permitted information. This is an offline simulation, not a secure two-device test.

## Live two-device fictional pilot (separate setup required)

1. Create an isolated Supabase project used only for fictional records and test email accounts.
2. Run `supabase/schema.sql`, then `supabase/migrate_build11_guardian_revocation.sql`. On a new project, migration `migrate_v7_release_gate.sql` is already represented in the current schema; for an older schema, review that migration first.
3. Configure email OTP with `{{ .Token }}`, an approved SMTP sender, and restrict signup to pilot participants. Use **two different fictional-guardian email accounts**, plus one teacher account.
4. Under Codemagic's app environment variables, optionally set **`TEACHER_STUDIO_SUPABASE_URL`** to `https://yourproject.supabase.co` and **`TEACHER_STUDIO_SUPABASE_PUBLISHABLE_KEY`** to the **public** project key. `scripts/build.mjs` embeds **only these public identifiers**, so parents don't have to enter service settings. **Never include `service_role`, `sb_secret_`, SMTP credentials, `.p8` signing keys or any private secrets in the app.**
5. Teachers sign in by email, create a fictional class, add a fictional student, generate a one-time invitation and **send the code through an approved channel**. The app does not send invitations on its own.
6. Each fictional guardian signs in with the **same email the teacher invited** and claims the code. Teachers can revoke a guardian's access or cancel a pending invitation through SQL functions that check authenticated classroom ownership.
7. Verify direct REST requests for guardian A cannot see guardian B's grades, messages, submissions or files, before and after release/revocation. Instructions in `PILOT_SECURITY_TESTS.md`.
8. Do not proceed to any real-school pilot without guardian authorization verification beyond email possession, district approval, data-processing/privacy review, retention and deletion controls, audit logging, moderation, backups and an independent security review.

**Important:** The server, not a role-switching UI control, enforces row access. The new app can suggest a role for navigation based on membership; that is never itself an authorization mechanism. Messages are fetched on opening or selecting **Refresh**, not delivered through background push notifications. Free cloud tiers don't guarantee reliable service or delivery.

## Build and TestFlight

The existing GitHub → Codemagic `codemagic.yaml` workflows are retained:

- `ios-compile-check`: native unsigned simulator compilation, requires Codemagic macOS builder.
- `ios-testflight`: native distribution signature and automatic TestFlight upload, requires registered Bundle ID, a Codemagic integration named `TeacherStudioASC`, Apple signing and app record.

App version **1.1.0**, bundle ID default `com.frontofus.teacherstudio` (unreserved). Exact identifiers in `capacitor.config.json`, `codemagic.yaml` and App Store Connect must match. Follow `TESTFLIGHT_STEPS_WINDOWS.md`.

## Local verification

```bash
npm run test
npm run test:package
python tests/family-browser.py  # Optional Chromium mounted DOM test; navigations may be blocked in restricted environments
```

Tests pass for the 67,200 math questions, encrypted teacher data backups, mock cloud calls, family rendering boundaries, simulated invitation creation, announcements/homework and demo parent visibility. A passing local test is NOT a live cross-account RLS certification, App Store approval or physical iPhone validation.

## Project structure

- `web/` — complete, preserved offline Gloria Esser Teaching Tool plus new `family.js` / `family.css`.
- `web/pilot-config.js` — empty default public configuration, no secret keys.
- `supabase/` — existing locked-down schema and new teacher-controlled revocation/cancellation RPCs.
- `tests/` — original tests and Build 11 privacy/layout tests.
- `scripts/` — Capacitor web-to-native bundling, app icons and iOS Info.plist generation.
- `codemagic.yaml` — existing App Store pipeline.
- `PILOT_SECURITY_TESTS.md` — required two-account tests before any real usage.

**Product policy:** Teachers determine what they teach and what to release. Do not automatically publish a grade, send a message in a teacher's name, or imply that a guardian was verified merely because they possess an email account.

## Dedication and brand continuity

The public name is **Gloria Esser Teaching Tool** (26 characters). The iOS home-screen label is **Gloria Esser** to fit on the icon. Tagline: **Remember Why You Teach.** Named in recognition of Gloria Esser's 50 years teaching.

The internal iOS bundle ID `com.frontofus.teacherstudio`, Codemagic integration alias `TeacherStudioASC`, `teacherstudio_*` local data keys, and `.tsbackup` backup format remain unchanged for backward compatibility. This is a brand change, not a new app identity or a claim of live family synchronization.
