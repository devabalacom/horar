#!/usr/bin/env bash
# Rebuilds the site and the API from the working tree and restarts the service.
set -euo pipefail
cd "$(dirname "$0")/.."
SELF_HOST=true NEXT_PUBLIC_API_URL=/ npx next build
(cd server && npm run build)
systemctl --user restart horar.service
sleep 2
curl -fsS http://127.0.0.1:8080/api/health && echo
