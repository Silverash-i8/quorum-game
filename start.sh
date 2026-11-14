#!/bin/sh
# QUORUM launcher for macOS and Linux.
cd "$(dirname "$0")" || exit 1
IP=$( (ipconfig getifaddr en0 2>/dev/null) || (hostname -I 2>/dev/null | awk '{print $1}') )
[ -n "$IP" ] && export PUBLIC_URL="http://$IP:3000"
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "Using Docker."; docker compose up --build -d || exit 1
elif command -v node >/dev/null 2>&1; then
  echo "Using Node.js. Press Ctrl+C to stop."; echo "Open: http://localhost:3000/"; exec node src/server.js
else
  echo "Install Docker Desktop or Node.js 18+, then run this again."; exit 1
fi
echo "Open on this computer:  http://localhost:3000/"
[ -n "$IP" ] && echo "Phones join at:                http://$IP:3000"
echo "Stop with: docker compose down"
