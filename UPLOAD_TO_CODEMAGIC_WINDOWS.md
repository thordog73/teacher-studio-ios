# Gloria Esser Teaching Tool — Upload to GitHub and Codemagic

This package is **source code**, not a signed `.ipa`. Upload the extracted project to **a private GitHub repository**, then connect that repository in Codemagic. It is not necessary to install Xcode on Windows.

## Before you begin

- Use the ZIP at `gloria-esser-codemagic-ready.zip`, extract it to **Downloads**. The extracted folder is `gloria-esser-codemagic-ready`.
- Create an **empty private** repo at https://github.com/new named `teacher-studio-ios` under `thordog73`. Do not pre-create a README, `.gitignore`, or license.
- Git for Windows must be installed. Open **Command Prompt**.

```cmd
cd /d "%USERPROFILE%\Downloads\gloria-esser-codemagic-ready"
python scripts\ci-preflight.py
git init
git add .
git commit -m "Gloria Esser Teaching Tool - TestFlight candidate"
git branch -M main
git remote add origin https://github.com/thordog73/teacher-studio-ios.git
git push -u origin main
```

If the repository already contains older Teacher Studio code, **do not force push**. Instead clone the existing repository, replace its project files with the newly extracted Build 11 files, preserve `.git`, and then `git add .`, `git commit`, `git push`. If the remote is already configured, skip `git remote add origin`. Never store private keys, student data, or API secrets in GitHub.

## Codemagic

1. In https://codemagic.io/apps select **Add application**, connect GitHub, and choose `teacher-studio-ios` → `main`.
2. Use the repository's **codemagic.yaml** (not Flutter's workflow editor).
3. Choose workflow **`ios-compile-check`** first. Its native compile check is **unsigned** and does not upload to Apple.
4. In Apple Developer and App Store Connect, verify the app's actual bundle ID. This package uses `com.frontofus.teacherstudio` and retains it for migration compatibility. If unavailable or different from an existing app record, change **both** `capacitor.config.json` and `codemagic.yaml` before running a signed build, and update the validation check in `scripts/ci-preflight.py`.
5. Register an App Store Connect application for **Gloria Esser Teaching Tool** and integrate your Apple API key in Codemagic as **`TeacherStudioASC`**. Codemagic must be allowed to fetch App Store distribution signing assets for the same bundle ID. Store the `.p8` in the Codemagic integration, NOT in GitHub.
6. Run **`ios-testflight`** to archive a signed `.ipa` and upload it to App Store Connect/TestFlight. Apple still processes the build; this is not automatically a public App Store release.

### Important build adjustments in this ZIP

- Capacitor 8 defaults to Swift Package Manager. This project specifically runs `npx cap add ios --packagemanager CocoaPods`, matching the `.xcworkspace` and `pod install` commands in the workflow.
- Codemagic exports `PROJECT_BUILD_NUMBER`; Build 11 uses it for iOS `CFBundleVersion`, and reads `1.1.0` from `package.json` for the marketing version.
- Native app build requires **Xcode 26+** and **Node 22+**. Workflows use `xcode: latest` and `node: 22`, with an early toolchain check.
- This project does **not** include signed Apple certificates, provisioning profiles, app-specific `.ipa`, or a live backend. Codemagic fetches npm/CocoaPods packages from their registries at build time.

### If `npm install` fails

Check the Codemagic build log for npm network/package errors. Package-lock was not generated here because network access to the npm registry was unavailable. Dependencies are declared in `package.json`. Before public release, generate and commit a reproducible lockfile using `npm install --package-lock-only` on a networked machine, then consider switching Codemagic to `npm ci`.

### Beta privacy boundary

The offline Teacher/Parent mode is only a fictional-data demonstration. Do not enter real students, real parent contact details, grades or student photos. The optional Supabase pilot remains unconfigured; it needs authenticated cross-device tests, authorization and revocation checks, school approval, and independent security review before handling student information.

### Official references

- https://docs.codemagic.io/yaml-code-signing/signing-ios/
- https://docs.codemagic.io/yaml-publishing/app-store-connect/
- https://capacitorjs.com/docs/updating/8-0
- https://docs.codemagic.io/knowledge-codemagic/build-versioning/
