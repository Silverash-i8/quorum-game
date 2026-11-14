@echo off
cd /d "%~dp0"
where docker >nul 2>nul
if errorlevel 1 goto nodeonly
set "HOST_PORT=8377"
docker compose --profile tunnel down
:nodeonly
echo.
echo   If you started the game with Node.js, close the "Quorum server" window.
echo.
pause
