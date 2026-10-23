@echo off
setlocal
 title Aquaculture Alerts & Risk Monitoring
 echo ========================================================
 echo  Aquaculture Alerts - Dashboard and FastAPI backend
 echo  The included prebuilt dashboard does not need Node.js.
 echo ========================================================
 echo.

REM Prefer the existing project virtual environment if this backend folder
REM was extracted next to the project's .venv folder.
set "PYTHON_CMD=python"
if exist "..\.venv\Scripts\python.exe" set "PYTHON_CMD=..\.venv\Scripts\python.exe"

%PYTHON_CMD% --version
if errorlevel 1 (
  echo Python was not found. Install Python 3.11 and try again.
  pause
  exit /b 1
)

echo.
echo Checking/installing backend dependencies. This can take a while on first run.
%PYTHON_CMD% -m pip install -r requirements.txt
if errorlevel 1 (
  echo Dependency installation failed. Please check the error above.
  pause
  exit /b 1
)

echo.
echo Starting dashboard and API at http://127.0.0.1:8000
%PYTHON_CMD% -m uvicorn main:app --host 127.0.0.1 --port 8000
pause
