# Teacher Studio → GitHub → Codemagic → TestFlight

This is the shortest **Windows-first** deployment path. The downloaded ZIP contains **source code**, not a signed `.ipa`.

## 1. Upload and start TestFlight

Extract **teacher-studio-build12-testflight.zip** into any convenient folder. Keep the full package together. Double-click **UPDATE.cmd**, or run this from Command Prompt in that extracted folder:

```cmd
UPDATE.cmd
```

That is the normal upload command. It pushes the included source to the existing GitHub repository, starts the signed **ios-testflight** workflow through the Codemagic API, and prints the build link. There is no routine Codemagic website step.

Use your existing Codemagic API token if the command window asks. The prompt hides the token and does not save it. If your existing environment already supplies `CM_API_TOKEN`, `CODEMAGIC_API_TOKEN` or `CODEMAGIC_TOKEN`, the launcher uses that instead. Use the token in the command window, not in the app source or chat.

Git for Windows and Node.js 18 or newer must be installed. Complete Git's normal sign-in prompt if it appears. No local npm installation or iOS build is needed. The launcher uses its own folder, clones `https://github.com/thordog73/teacher-studio-ios.git` into a temporary folder, copies only the shipped release files, commits when needed and performs a normal push to `main`.

The automatic step checks the exact GitHub repository and uploaded commit, finds the existing Codemagic application, and requests **ios-testflight** on **main**. It keeps a nonsecret record under your local application-data folder so running the command again can reuse the current build. An uncertain network response is checked before another request is allowed. It does not create another Codemagic app or change your Apple signing setup.

**21 October upload update:** the launcher now starts the build automatically, like the other app launchers. The **20 October CocoaPods correction** remains included and fixes the previously reported missing `Podfile` and privacy-script directory errors.

A build link confirms that Codemagic accepted the request. The cloud build must still compile, sign and upload successfully, and Apple must process the upload before it is ready in TestFlight.

The following sections are setup reference for accounts where Apple or Codemagic configuration is incomplete. Existing configured accounts keep their current setup.

## 2. Register the iOS app in Apple

In Apple Developer, register the Bundle ID `com.frontofus.teacherstudio` **only if available and intended**. Otherwise choose a unique identifier and change **both** `capacitor.config.json` and `codemagic.yaml` to match. In App Store Connect, create the app record named **Teacher Studio**, platform **iOS**, and the exact Bundle ID. The app record must exist before automatic distribution.

Under App Store Connect **Users and Access → Integrations → App Store Connect API**, create an API key with the rights required by Codemagic (normally App Manager). Save the `.p8` privately: Apple normally allows a single download. The API key never belongs in source control.

## 3. Connect Codemagic

1. In Codemagic, add the GitHub repository as an application and choose the repository's `codemagic.yaml`.
2. Create an App Store Connect integration named **`TeacherStudioASC`** (or change the integration name in `codemagic.yaml` to what you choose).
3. **For a fictional connected pilot**, set Codemagic environment variables `TEACHER_STUDIO_SUPABASE_URL` and `TEACHER_STUDIO_SUPABASE_PUBLISHABLE_KEY` to the project URL and **publishable** key of your isolated Supabase project. Read `PILOT_SECURITY_TESTS.md` and run the SQL migrations first. This prevents parents from entering database settings manually. Never embed a secret/service-role key; without these values the app runs as a local fictional-data demo.
4. Under code signing, configure an **Apple Distribution certificate** and **App Store provisioning profile** for the exact bundle ID; Codemagic can help create/fetch them through its Apple integration.
5. The **`ios-compile-check`** workflow is available for an optional unsigned simulator check when diagnosing a native compilation problem. It does not upload to Apple.
6. For routine uploads, use **`UPDATE.cmd`**. It starts **`ios-testflight`**, which builds an IPA, signs it, uploads it to App Store Connect, and requests TestFlight processing.

The generated Xcode project is created by `npx cap add ios --packagemanager CocoaPods` **on Codemagic's Mac**. The explicit package manager creates the `Podfile` and Xcode workspace used by this pipeline. No checked-in native iOS project is needed for this workflow. Dependencies download at build time; installed app content runs offline.

## 4. Distribute via TestFlight

In App Store Connect, select **Teacher Studio → TestFlight** and complete all required processing and beta information. Add internal testers to start. External tester groups may require Beta App Review. Builds expire after Apple's TestFlight time limit. The tester's device must have the Apple **TestFlight** app installed.

**Initial test group:** people testing the app with **fictional student records only**. The optional cloud pilot is not a production family portal. If you want to test teacher-to-parent cross-device synchronization, first create an isolated Supabase project, run the included schema, configure test email OTP, and independently test guardian access/RLS with at least two fictional student records and two distinct guardian accounts. Never use real children's information in this unscreened beta.

## 5. Information Apple will request

- App name, category, screenshots, beta notes, support contact, live privacy policy URL and App Privacy responses (the included draft needs a real URL and legal review).
- Export-compliance answers: Teacher Studio implements AES-GCM/PBKDF2 for encrypted personal backups; do not blindly claim it uses no encryption.
- School-data disclosures, account deletion/access rights and reviewer access as relevant if online login is enabled.
- Explain that the app has offline maths/worksheet/productivity features and native iOS encrypted-backup file sharing—it's not just a static website.

## 6. Check a build or handle a failed request

To check the most recently saved request without uploading or starting a build, use `UPDATE.cmd --status`. A repeated normal `UPDATE.cmd` checks a build already associated with the uploaded commit and avoids starting a duplicate. The helper only reports the Codemagic status it can verify; a finished build is not a substitute for checking Apple's separate TestFlight processing and review state.

If Codemagic reports that the last attempt failed, was cancelled, timed out or was skipped, fix the reported cause. Run the normal command to upload a source correction. If the fix was only in the existing signing/account configuration and the source did not change, `UPDATE.cmd --retry` requests another build only after the helper verifies the previous attempt ended unsuccessfully. It does not override an in-progress, successful or unresolved request.

If the connection drops while starting a build, keep the printed message and run the status check; do not delete the saved state to force another request. The launcher preserves uncertain requests because Codemagic may have accepted them before the connection failed.

Use the printed build link when logs are needed. Common causes:
- Wrong integration reference `TeacherStudioASC` / Apple API key permissions.
- Bundle ID mismatch across Apple / `capacitor.config.json` / `codemagic.yaml`.
- Missing Distribution certificate or App Store provisioning profile.
- Network dependency/npm/pod download failure on the macOS builder.
- Xcode or iOS plugin compatibility changes: inspect compile log; keep Capacitor major versions aligned.

Do **not** share your signing key or private credentials in chat. Share redacted error messages and logs instead.

## Verified public references

- https://docs.codemagic.io/rest-api/builds/
- https://docs.codemagic.io/integrations/jenkins-integration/
- https://codemagic.io/api/v3/schema
- https://docs.codemagic.io/yaml-quick-start/building-an-ionic-app/
- https://docs.codemagic.io/yaml-code-signing/signing-ios/
- https://capacitorjs.com/docs/ios
- https://capacitorjs.com/docs/updating/8-0
- https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/
- https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance
