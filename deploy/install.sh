#!/usr/bin/env bash
# Installs horar as systemd --user services on this VPS (no root needed):
# Postgres, the site+API on :8080, and a daily backup. Run it yourself:
#   bash ~/horar/deploy/install.sh
set -euo pipefail
# Copies started by hand (e.g. from a Claude session) hold ports 8080 and
# 54329; stop them so the services can bind.
pkill -f "node --env-file=.env dist/[i]ndex.js" || true
pkill -TERM -f "node [r]un.mjs" || true
for i in $(seq 20); do ss -ltn | grep -qE ":(8080|54329) " || break; sleep 1; done
here="$(cd "$(dirname "$0")" && pwd)"
dest="$HOME/.config/systemd/user"
mkdir -p "$dest"
cp "$here"/systemd/horar*.service "$here"/systemd/horar*.timer "$dest"/
# Keep user services running after logout and across reboots.
loginctl enable-linger "$USER" || echo "!! enable-linger failed: ask an admin to run: sudo loginctl enable-linger $USER"
systemctl --user daemon-reload
systemctl --user enable --now horar-pg.service horar.service horar-backup.timer
sleep 3
systemctl --user --no-pager status horar-pg horar | grep -E "●|Active:"
curl -fsS http://127.0.0.1:8080/api/health && echo
