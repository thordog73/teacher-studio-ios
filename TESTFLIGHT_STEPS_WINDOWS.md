# Teacher Studio → GitHub → Codemagic → TestFlight

This is the shortest **Windows-first** deployment path. The downloaded ZIP contains **source code**, not a signed `.ipa`.

## 1. Update your existing GitHub repository

Extract **teacher-studio-build12-testflight.zip** into any convenient folder. It contains the upload launcher beside `package.json` and `codemagic.yaml`.

Double-click **UPDATE.cmd**, or run this from Command Prompt in that extracted folder:

```cmd
UPDATE.cmd
```

The launcher uses its own location, so it does not depend on an old folder name or the Downloads path. It clones the existing `main` branch of `https://github.com/thordog73/teacher-studio-ios.git` into a temporary folder, copies the shipped files listed in `UPDATE-FILES.txt`, commits the update if necessary, and performs a normal push to `main`. It preserves repository history and stops on an error. A successful update opens Codemagic.

The existing repository and Git for Windows must be available. Complete Git's normal sign-in prompt if it appears. No new repository or local npm/iOS build is needed for this update.

In Codemagic, open the application connected to **teacher-studio-ios**, choose **Start new build**, branch **main**, workflow **ios-testflight**. This package retains manual build initiation; uploading source does not itself start TestFlight processing.

The following sections describe the Apple/Codemagic setup for accounts where it has not yet been completed. Existing configured accounts can keep that setup.

## 2. Register the iOS app in Apple

In Apple Developer, register the Bundle ID `com.frontofus.teacherstudio` **only if available and intended**. Otherwise choose a unique identifier and change **both** `capacitor.config.json` and `codemagic.yaml` to match. In App Store Connect, create the app record named **Teacher Studio**, platform **iOS**, and the exact Bundle ID. The app record must exist before automatic distribution.

Under App Store Connect **Users and Access → Integrations → App Store Connect API**, create an API key with the rights required by Codemagic (normally App Manager). Save the `.p8` privately: Apple normally allows a single download. The API key never belongs in source control.

## 3. Connect Codemagic

1. In Codemagic, add the GitHub repository as an application and choose the repository's `codemagic.yaml`.
2. Create an App Store Connect integration named **`TeacherStudioASC`** (or change the integration name in `codemagic.yaml` to what you choose).
3. **For a fictional connected pilot**, set Codemagic environment variables `TEACHER_STUDIO_SUPABASE_URL` and `TEACHER_STUDIO_SUPABASE_PUBLISHABLE_KEY` to the project URL and **publishable** key of your isolated Supabase project. Read `PILOT_SECURITY_TESTS.md` and run the SQL migrations first. This prevents parents from entering database settings manually. Never embed a secret/service-role key; without these values the app runs as a local fictional-data demo.
4. Under code signing, configure an **Apple Distribution certificate** and **App Store provisioning profile** for the exact bundle ID; Codemagic can help create/fetch them through its Apple integration.
5. Run the **`ios-compile-check`** workflow first. Resolve any compiler, Xcode, CocoaPods or signing issues it reports. This step does not upload to Apple.
6. Run **`ios-testflight`**. It builds an IPA, signs it, uploads it to App Store Connect, and requests TestFlight processing.

The generated Xcode project is created by `npx cap add ios` **on Codemagic's Mac**. No checked-in native iOS project is needed for this workflow. Dependences download at build time; installed app content runs offline.

## 4. Distribute via TestFlight

In App Store Connect, select **Teacher Studio → TestFlight** and complete all required processing and beta information. Add internal testers to start. External tester groups may require Beta App Review. Builds expire after Apple's TestFlight time limit. The tester's device must have the Apple **TestFlight** app installed.

**Initial test group:** people testing the app with **fictional student records only**. The optional cloud pilot is not a production family portal. If you want to test teacher-to-parent cross-device synchronization, first create an isolated Supabase project, run the included schema, configure test email OTP, and independently test guardian access/RLS with at least two fictional student records and two distinct guardian accounts. Never use real children's information in this unscreened beta.

## 5. Information Apple will request

- App name, category, screenshots, beta notes, support contact, live privacy policy URL and App Privacy responses (the included draft needs a real URL and legal review).
- Export-compliance answers: Teacher Studio implements AES-GCM/PBKDF2 for encrypted personal backups; do not blindly claim it uses no encryption.
- School-data disclosures, account deletion/access rights and reviewer access as relevant if online login is enabled.
- Explain that the app has offline maths/worksheet/productivity features and native iOS encrypted-backup file sharing—it's not just a static website.

## 6. If your build fails

Download the Codemagic logs. Common causes:
- Wrong integration reference `TeacherStudioASC` / Apple API key permissions.
- Bundle ID mismatch across Apple / `capacitor.config.json` / `codemagic.yaml`.
- Missing Distribution certificate or App Store provisioning profile.
- Network dependency/npm/pod download failure on the macOS builder.
- Xcode or iOS plugin compatibility changes: inspect compile log; keep Capacitor major versions aligned.

Do **not** share your signing key or private credentials in chat. Share redacted error messages and logs instead.

## Verified public references

- https://docs.codemagic.io/yaml-quick-start/building-an-ionic-app/
- https://docs.codemagic.io/yaml-code-signing/signing-ios/
- https://capacitorjs.com/docs/ios
- https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/
- https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance
