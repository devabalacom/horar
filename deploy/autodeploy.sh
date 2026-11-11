#!/usr/bin/env bash
# Continuous deployment, pull-based: run every minute by horar-autodeploy.timer.
# When origin/main has a new commit and GitHub Actions CI passed on it, this
# fast-forwards the checkout, installs dependencies if the lockfiles changed
# and runs deploy/update.sh. Nothing on GitHub holds a key to this server.
#
# The checkout must be on main with a clean tree; otherwise the run is
# skipped (do feature work in a branch of another clone or a git worktree).
set -euo pipefail
cd "$(dirname "$0")/.."
exec 9>"${XDG_RUNTIME_DIR:-/tmp}/horar-autodeploy.lock"
flock -n 9 || exit 0

REPO=devabalacom/horar
log() { echo "autodeploy: $*"; }

branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != main ]; then log "skip: checkout is on '$branch', not main"; exit 0; fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then log "skip: uncommitted changes"; exit 0; fi

git fetch --quiet origin main
local_sha=$(git rev-parse HEAD)
remote_sha=$(git rev-parse origin/main)
[ "$local_sha" = "$remote_sha" ] && exit 0
if ! git merge-base --is-ancestor "$local_sha" "$remote_sha"; then
  log "skip: origin/main ($remote_sha) is not a fast-forward of $local_sha"; exit 0
fi

# Wait for CI on that commit (public repo: no token needed).
runs=$(curl -fsS -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/actions/runs?head_sha=$remote_sha&event=push&branch=main&per_page=20" || true)
state=$(printf '%s' "$runs" | node -e '
  let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
    let runs = [];
    try { runs = JSON.parse(s).workflow_runs.filter((r) => r.name === "CI"); } catch {}
    if (!runs.length) return console.log("pending");
    const r = runs[0];
    console.log(r.status !== "completed" ? "pending" : r.conclusion);
  });')
case "$state" in
  success) ;;
  pending) exit 0 ;;
  *)
    marker="${XDG_RUNTIME_DIR:-/tmp}/horar-autodeploy.failed"
    if [ "$(cat "$marker" 2>/dev/null)" != "$remote_sha" ]; then
      log "not deploying $remote_sha: CI $state"; echo "$remote_sha" >"$marker"
    fi
    exit 0 ;;
esac

log "deploying $local_sha -> $remote_sha"
changed=$(git diff --name-only "$local_sha" "$remote_sha")
git merge --ff-only --quiet origin/main
if grep -qx 'package-lock.json' <<<"$changed"; then npm ci --no-audit --no-fund; fi
if grep -qx 'server/package-lock.json' <<<"$changed"; then (cd server && npm ci --no-audit --no-fund); fi
if grep -q '^deploy/systemd/' <<<"$changed"; then
  cp deploy/systemd/horar*.service deploy/systemd/horar*.timer "$HOME/.config/systemd/user/"
  systemctl --user daemon-reload
fi
bash deploy/update.sh
log "deployed $remote_sha"
