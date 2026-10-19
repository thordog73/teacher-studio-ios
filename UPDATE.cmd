@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "TS_SOURCE=%~dp0"
set "TS_REPO=https://github.com/thordog73/teacher-studio-ios.git"
set "TS_MANIFEST=%~dp0UPDATE-FILES.txt"
set "TS_RESULT=1"
set "TS_NOPAUSE="
if /i "%~1"=="/nopause" set "TS_NOPAUSE=1"

echo Teacher Studio Build 12 - GitHub updater
echo Source: "%TS_SOURCE%"
echo.
echo [1/5] Checking this source package and Git...
where git >nul 2>nul
if errorlevel 1 (
  set "TS_ERROR=Git was not found. Install Git for Windows, then run UPDATE.cmd again."
  goto failed
)
for %%F in (package.json codemagic.yaml web\app.js UPDATE-FILES.txt) do if not exist "%TS_SOURCE%%%F" (
  set "TS_ERROR=The extracted package is incomplete. Missing: %%F"
  goto failed
)
findstr /r /v /x /c:"[A-Za-z0-9_.][A-Za-z0-9_. /-]*" "%TS_MANIFEST%" >nul
if errorlevel 2 (
  set "TS_ERROR=The release file list could not be read. Extract the complete ZIP again."
  goto failed
)
if not errorlevel 1 (
  set "TS_ERROR=The release file list contains an unsupported path. Extract the complete ZIP again."
  goto failed
)
for %%F in (package.json codemagic.yaml web/app.js UPDATE.cmd UPDATE-FILES.txt) do (
  findstr /l /x /c:"%%F" "%TS_MANIFEST%" >nul
  if errorlevel 1 (
    set "TS_ERROR=The release file list is incomplete. Missing: %%F"
    goto failed
  )
)
for /f "usebackq delims=" %%F in ("%TS_MANIFEST%") do (
  set "TS_ENTRY=%%F"
  call :check_file
  if errorlevel 1 goto failed
)
if not defined TEMP (
  set "TS_ERROR=Windows TEMP is not set. The updater cannot create a temporary checkout."
  goto failed
)

:choose_work
set "TS_WORK=%TEMP%\TeacherStudio-Build12-%RANDOM%-%RANDOM%"
if exist "%TS_WORK%" goto choose_work
mkdir "%TS_WORK%"
if errorlevel 1 (
  set "TS_ERROR=Could not create the temporary working folder."
  goto failed
)
set "TS_CHECKOUT=%TS_WORK%\repo"
echo [2/5] Downloading the existing main branch. Git may request GitHub sign-in.
git -c core.symlinks=false clone --branch main --single-branch "%TS_REPO%" "%TS_CHECKOUT%"
if errorlevel 1 (
  set "TS_ERROR=Git clone failed. No update was pushed. See the Git message above."
  goto failed
)

git -C "%TS_CHECKOUT%" ls-files --stage > "%TS_WORK%\tracked-files.txt"
if errorlevel 1 (
  set "TS_ERROR=Git could not inspect tracked files. No update was pushed."
  goto failed
)
findstr /b /l /c:"120000 " "%TS_WORK%\tracked-files.txt" >nul
if errorlevel 2 (
  set "TS_ERROR=Could not check the tracked-file list. No update was pushed."
  goto failed
)
if not errorlevel 1 (
  set "TS_ERROR=The GitHub repository contains tracked symbolic links. Copy stopped to avoid changing a link target or retaining a link mode. No update was pushed."
  goto failed
)

echo [3/5] Copying only files named in UPDATE-FILES.txt...
for /f "usebackq delims=" %%F in ("%TS_MANIFEST%") do (
  set "TS_ENTRY=%%F"
  call :copy_file
  if errorlevel 1 goto failed
)
echo [4/5] Preparing the update commit...
git -C "%TS_CHECKOUT%" add --pathspec-from-file="%TS_MANIFEST%"
if errorlevel 1 (
  set "TS_ERROR=Git could not stage the release files. No update was pushed."
  goto failed
)
git -C "%TS_CHECKOUT%" diff --cached --quiet
if errorlevel 2 (
  set "TS_ERROR=Git could not check the staged changes. No update was pushed."
  goto failed
)
if not errorlevel 1 goto push_update
git -C "%TS_CHECKOUT%" commit -m "Teacher Studio Build 12 - Today and families"
if errorlevel 1 (
  set "TS_ERROR=Git commit failed. See the message above; Git identity or signing may need setup."
  goto failed
)

:push_update
echo [5/5] Pushing main to the existing repository...
git -C "%TS_CHECKOUT%" push origin main
if errorlevel 1 (
  set "TS_ERROR=Git push failed. No force push was attempted. Keep the output above for diagnosis."
  goto failed
)
echo.
echo SUCCESS: The Build 12 source is on GitHub main.
echo In Codemagic, select this app, Start new build, main, and ios-testflight.
echo GitHub upload does not by itself run the Apple build.
set "TS_RESULT=0"
start "" "https://codemagic.io/apps"
goto finished

:check_file
set "TS_REL=%TS_ENTRY:/=\%"
if not "%TS_ENTRY:..=%"=="%TS_ENTRY%" goto bad_path
for %%P in ("%TS_ENTRY:/=" "%") do (
  if /i "%%~P"==".git" goto bad_path
)
if not exist "%TS_SOURCE%%TS_REL%" (
  set "TS_ERROR=A listed release file is missing: %TS_ENTRY%"
  exit /b 1
)
if exist "%TS_SOURCE%%TS_REL%\" goto bad_path
exit /b 0

:bad_path
set "TS_ERROR=The release file list contains an unsafe or non-file path. Extract the complete ZIP again."
exit /b 1

:copy_file
set "TS_REL=%TS_ENTRY:/=\%"
for %%P in ("%TS_CHECKOUT%\%TS_REL%") do if not exist "%%~dpP" (
  mkdir "%%~dpP"
  if errorlevel 1 (
    set "TS_ERROR=Could not create a destination folder for: %TS_ENTRY%"
    exit /b 1
  )
)
copy /b /y "%TS_SOURCE%%TS_REL%" "%TS_CHECKOUT%\%TS_REL%" >nul
if errorlevel 1 (
  set "TS_ERROR=Copy failed for: %TS_ENTRY%"
  exit /b 1
)
exit /b 0

:failed
echo.
echo UPDATE STOPPED: %TS_ERROR%
if defined TS_WORK echo Temporary work retained at: "%TS_WORK%"
echo No reset, clean, or force push was used.

:finished
if not defined TS_NOPAUSE pause
endlocal & exit /b %TS_RESULT%
