#!/usr/bin/env bash
#
# Serves the built demo (demo-app/.output) with its own Nitro server, in a Node.js container, on
# 127.0.0.1:<port> (3000 by default).
#
#   bash .github/scripts/serve-demo.sh [port]

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
NODE_IMAGE="${NODE_IMAGE:-node:24-bookworm-slim@sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530}"
DEMO_DIR="${DEMO_DIR:-$ROOT/demo-app}"
PORT="${1:-3000}"

exec docker run --rm --name "vue-steps-demo-${PORT}" -u "$(id -u):$(id -g)" -e PORT=3000 -e HOST=0.0.0.0 \
  -p "127.0.0.1:${PORT}:3000" -v "$DEMO_DIR:/app:ro" -w /app "$NODE_IMAGE" node .output/server/index.mjs < /dev/null
