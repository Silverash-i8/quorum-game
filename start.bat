@echo off
setlocal
cd /d "%~dp0"
title Quorum
echo.
echo   Starting QUORUM
echo.

rem Find this computer's Wi-Fi address so the QR code points phones at it.
set "IP="
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1).IPv4Address.IPAddress"`) do set "IP=%%i"
set "PUBLIC_URL="
if defined IP set "PUBLIC_URL=http://%IP%:3000"

rem Node.js first: phones on the same Wi-Fi can reach it directly. Docker is the fallback.
where node >nul 2>nul
if not errorlevel 1 goto usenode
where docker >nul 2>nul
if errorlevel 1 goto nothing
docker info >nul 2>nul
if errorlevel 1 goto startdocker
echo   Using Docker. The first start takes a minute or two.
docker compose up --build -d
if errorlevel 1 goto failed
goto open

:dockeroff
where node >nul 2>nul
if errorlevel 1 goto startdocker
echo   Docker is installed but not running, so Node.js is used instead.
goto usenode

:startdocker
echo   Docker is installed but not running.
echo   Start Docker Desktop, wait until it says it is running, then run this file again.
goto end

:trynode
where node >nul 2>nul
if errorlevel 1 goto nothing

:usenode
echo   Using Node.js. Keep the new window open while you play.
start "Quorum server" cmd /k node src\server.js
goto open

:nothing
echo   Neither Docker nor Node.js was found on this computer.
echo   Install Docker Desktop from https://www.docker.com/products/docker-desktop/
echo   or Node.js 18 or newer from https://nodejs.org/ and run this file again.
goto end

:failed
echo.
echo   Docker could not start Quorum. Read the messages above.
goto end

:open
timeout /t 4 /nobreak >nul
start "" http://localhost:3000/
echo.
echo   Open this on this computer:     http://localhost:3000/
if defined IP echo   Phones join at:                 http://%IP%:3000
if not defined IP echo   No Wi-Fi address found. Connect to Wi-Fi or a hotspot, then run this file again.
echo.
echo   Phones must be on the same Wi-Fi or hotspot as this computer.
echo   To stop the game, run stop.bat.

:end
echo.
pause
