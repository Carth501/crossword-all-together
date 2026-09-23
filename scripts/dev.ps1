# Launches the backend (FastAPI/uvicorn) and frontend (Vite) dev servers,
# each in its own separate PowerShell window.
$root = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent

Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "cd '$root\backend'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
)

Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "cd '$root'; npm run dev"
)
