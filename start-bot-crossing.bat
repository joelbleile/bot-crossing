@echo off
rem Starts Bot Crossing and opens it in your browser. Close this window to stop it.
cd /d "%~dp0"
if not exist node_modules call npm install
start "" /b cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:5274"
call npm run dev
