@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "TS_SOURCE=%~dp0"
set "TS_REPO=https://github.com/thordog73/teacher-studio-ios.git"
set "TS_MANIFEST=%~dp0UPDATE-FILES.txt"
set "TS_RESULT=1"
set "TS_NOPAUSE="
set "TS_STATUS="
set "TS_RETRY="

:options
if "%~1"=="" goto start_update
if /i "%~1"=="/nopause" (
  set "TS_NOPAUSE=1"
  shift
  goto options
)
if /i "%~1"=="--status" (
  set "TS_STATUS=1"
  shift
  goto options
)
if /i "%~1"=="--retry" (
  set "TS_RETRY=--retry"
  shift
  goto options
)
set "TS_ERROR=Unknown option. Run UPDATE.cmd for the normal upload."
goto failed

:start_update
if defined TS_STATUS if defined TS_RETRY (
  set "TS_ERROR=Use --status or --retry separately."
  goto failed
)
echo Teacher Studio Build 12 - Upload and start TestFlight
echo Source: "%TS_SOURCE%"
echo.
where node >nul 2>nul
if errorlevel 1 (
  set "TS_ERROR=Node.js was not found. Install the current Node.js LTS, then run UPDATE.cmd again."
  goto failed
)
node -e "if(Number(process.versions.node.split('.')[0])<18)process.exit(1)" >nul 2>nul
if errorlevel 1 (
  set "TS_ERROR=This launcher needs Node.js 18 or newer. Install the current Node.js LTS."
  goto failed
)
if not exist "%TS_SOURCE%scripts\start-testflight.cjs" (
  set "TS_ERROR=The extracted package is incomplete. Missing: scripts\start-testflight.cjs"
  goto failed
)
if defined TS_STATUS goto check_status
echo [1/6] Checking this source package and Git...
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
for %%F in (package.json codemagic.yaml web/app.js UPDATE.cmd UPDATE-FILES.txt scripts/start-testflight.cjs) do (
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
echo [2/6] Downloading the existing main branch. Git may request GitHub sign-in.
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

echo [3/6] Copying only files named in UPDATE-FILES.txt...
for /f "usebackq delims=" %%F in ("%TS_MANIFEST%") do (
  set "TS_ENTRY=%%F"
  call :copy_file
  if errorlevel 1 goto failed
)
echo [4/6] Preparing the update commit...
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
echo [5/6] Pushing main to the existing repository...
git -C "%TS_CHECKOUT%" push origin main
if errorlevel 1 (
  set "TS_ERROR=Git push failed. No force push was attempted. Keep the output above for diagnosis."
  goto failed
)
echo.
echo The Build 12 source is on GitHub main.
echo [6/6] Starting the signed TestFlight build...
node "%TS_SOURCE%scripts\start-testflight.cjs" --checkout "%TS_CHECKOUT%" %TS_RETRY%
if errorlevel 1 (
  set "TS_ERROR=The source is on GitHub, but the build request needs attention. See the message above."
  goto failed
)
set "TS_RESULT=0"
goto finished

:check_status
node "%TS_SOURCE%scripts\start-testflight.cjs" --status
set "TS_RESULT=%ERRORLEVEL%"
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
