@echo off
setlocal
cd /d "%~dp0"
echo.
echo Gloria Esser Teaching Tool - Codemagic source preflight
echo --------------------------------------------------------
where git >nul 2>&1
if errorlevel 1 (
  echo Git for Windows is required before pushing to GitHub.
  exit /b 1
)
where python >nul 2>&1
if errorlevel 1 (
  echo Python is optional for upload; skipping local preflight.
) else (
  python scripts\ci-preflight.py
  if errorlevel 1 exit /b 1
)
echo.
echo Files are ready to commit. Review UPLOAD_TO_CODEMAGIC_WINDOWS.md.
echo Repo: https://github.com/thordog73/teacher-studio-ios
exit /b 0
