@echo off
setlocal
cd /d "%~dp0"
title Quorum (public address)
echo.
echo   Starting Quorum in Docker with a public address,
echo   so phones can join from any Wi-Fi or mobile data.
echo.
echo starting> public-address.txt

where docker >nul 2>nul
if errorlevel 1 goto nodocker
docker info >nul 2>nul
if errorlevel 1 goto notrunning

rem Stop an earlier Docker copy. This one uses its own port on this computer, so it never clashes with start.bat or other projects.
docker compose --profile tunnel down >nul 2>nul
rem Remove the containers of the earlier four-game version, which used the same port.
docker rm -f cellout cell-out-tunnel-1 >nul 2>nul
set "HOST_PORT=8377"

set "PUBLIC_URL="
echo   Building and starting. The first time takes a few minutes.
echo building> public-address.txt
docker compose --profile tunnel up --build -d > start-public.log 2>&1
set "RC=%errorlevel%"
type start-public.log
if not "%RC%"=="0" goto failed

echo.
echo   Waiting for the public address...
set "URL="
set /a tries=0
:wait
set /a tries+=1
for /f "usebackq delims=" %%u in (`powershell -NoProfile -Command "(docker compose logs tunnel | Select-String -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches | ForEach-Object { $_.Matches.Value } | Select-Object -Last 1)"`) do set "URL=%%u"
if defined URL goto ready
if %tries% geq 40 goto nourl
timeout /t 2 /nobreak >nul
goto wait

:ready
echo %URL%> public-address.txt
timeout /t 4 /nobreak >nul
start "" "%URL%/"
echo.
echo   Quorum is live at:
echo.
echo       %URL%
echo.
echo   Open that address on this computer and host a game from it.
echo   The QR code will then work for any phone with an internet connection.
echo   The address changes every time this file is run. It is also saved in public-address.txt.
echo   To stop, run stop.bat.
goto end

:nodocker
echo docker-not-installed> public-address.txt
echo   Docker was not found. Install Docker Desktop, or use start.bat and a hotspot instead.
goto end

:notrunning
echo docker-not-running> public-address.txt
echo   Docker Desktop is installed but not running.
echo   Start Docker Desktop, wait until it says the engine is running, then run this file again.
goto end

:failed
echo failed> public-address.txt
echo.
echo   Docker could not start Quorum. Read the messages above.
echo   The full output is in start-public.log.
goto end

:nourl
echo no-address> public-address.txt
echo.
echo   Quorum started but no public address appeared. This needs an internet connection.
echo   Run:  docker compose logs tunnel
echo   Quorum still works on this computer at http://localhost:8377/
goto end

:end
echo.
pause
