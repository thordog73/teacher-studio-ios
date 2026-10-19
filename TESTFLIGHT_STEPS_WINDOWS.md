**IMPORTANT:** This Codemagic-ready release has updated upload instructions in `UPLOAD_TO_CODEMAGIC_WINDOWS.md`. Follow those first; this file is retained for technical detail.

# Gloria Esser Teaching Tool → GitHub → Codemagic → TestFlight

This is the shortest **Windows-first** deployment path. The downloaded ZIP contains **source code**, not a signed `.ipa`.

## 1. Create a PRIVATE GitHub repository

On GitHub, create an empty private repository (for example `teacher-studio-ios`); do not initialize it with a README because this package already has one. Extract `gloria-esser-teaching-tool-build11.zip` to a new folder. Do not commit Apple `.p8` private keys, Supabase service-role keys, real student data, passwords, or signing certificates to GitHub.

In Windows Command Prompt, run (change the path and repository URL for your account):

```cmd
cd %USERPROFILE%\Downloads\gloria-esser-teaching-tool-build11
git init
git add .
git commit -m "Gloria Esser Teaching Tool TestFlight pilot"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/teacher-studio-ios.git
git push -u origin main
```

GitHub Desktop works as an alternative if Git is not installed.

## 2. Register the iOS app in Apple

In Apple Developer, register the Bundle ID `com.frontofus.teacherstudio` **only if available and intended**. Otherwise choose a unique identifier and change **both** `capacitor.config.json` and `codemagic.yaml` to match. In App Store Connect, create the app record named **Gloria Esser Teaching Tool**, platform **iOS**, and the exact Bundle ID. The app record must exist before automatic distribution.

Under App Store Connect **Users and Access → Integrations → App Store Connect API**, create an API key with the rights required by Codemagic (normally App Manager). Save the `.p8` privately: Apple normally allows a single download. The API key never belongs in source control.

## 3. Connect Codemagic

1. In Codemagic, add the GitHub repository as an application and choose the repository's `codemagic.yaml`.
2. Create an App Store Connect integration named **`TeacherStudioASC`** (or change the integration name in `codemagic.yaml` to what you choose).
3. Under code signing, configure an **Apple Distribution certificate** and **App Store provisioning profile** for the exact bundle ID; Codemagic can help create/fetch them through its Apple integration.
4. Run the **`ios-compile-check`** workflow first. Resolve any compiler, Xcode, CocoaPods or signing issues it reports. This step does not upload to Apple.
5. Run **`ios-testflight`**. It builds an IPA, signs it, uploads it to App Store Connect, and requests TestFlight processing.

The generated Xcode project is created by `npx cap add ios` **on Codemagic's Mac**. No checked-in native iOS project is needed for this workflow. Dependences download at build time; installed app content runs offline.

## 4. Distribute via TestFlight

In App Store Connect, select **Gloria Esser Teaching Tool → TestFlight** and complete all required processing and beta information. Add internal testers to start. External tester groups may require Beta App Review. Builds expire after Apple's TestFlight time limit. The tester's device must have the Apple **TestFlight** app installed.

**Initial test group:** people testing the app with **fictional student records only**. The optional cloud pilot is not a production family portal. If you want to test teacher-to-parent cross-device synchronization, first create an isolated Supabase project, run the included schema, configure test email OTP, and independently test guardian access/RLS with at least two fictional student records and two distinct guardian accounts. Never use real children's information in this unscreened beta.

## 5. Information Apple will request

- App name, category, screenshots, beta notes, support contact, live privacy policy URL and App Privacy responses (the included draft needs a real URL and legal review).
- Export-compliance answers: Gloria Esser Teaching Tool implements AES-GCM/PBKDF2 for encrypted personal backups; do not blindly claim it uses no encryption.
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

### Branding update
In App Store Connect, enter **Gloria Esser Teaching Tool** as the app name if available. The iPhone home-screen display name is shortened to **Gloria Esser**. Keep your existing bundle ID `com.frontofus.teacherstudio` and Codemagic `TeacherStudioASC` integration if previously configured; neither needs to change just to rename the app. Verify the App Store name is available before submission.
