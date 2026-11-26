#!/usr/bin/env bash
#
# Makes the app the suite runs on, in a Node.js container (nothing runs on the machine): the official
# starter of Nuxt's create tool (`nuxi init --template minimal`), with the pages of demo/ over it (this
# pack's own), then `npm install` and `npm run build`, into demo-app/ beside .github/.
#
#   NODE_IMAGE     the image it runs in (default: Node.js 24 on Debian bookworm, slim, pinned by its digest)
#   NUXI_VERSION   the release of the create tool (default 4.1.0)
#   DEMO_DIR       where the app goes (default: demo-app/, beside .github/)
#
# The starter is Nuxt's own (MIT): it is made here at each build, and nothing of it is kept in this
# repository; the pages of demo/ are this pack's.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
NODE_IMAGE="${NODE_IMAGE:-node:24-bookworm-slim@sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530}"
NUXI_VERSION="${NUXI_VERSION:-4.1.0}"
DEMO_DIR="${DEMO_DIR:-$ROOT/demo-app}"

if [ -e "$DEMO_DIR" ]; then
  echo "$DEMO_DIR is there already: remove it to make the demo again." >&2
  exit 1
fi
parent="$(dirname "$DEMO_DIR")"
name="$(basename "$DEMO_DIR")"
mkdir -p "$parent"

docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -e npm_config_cache=/tmp/.npm -e npm_config_update_notifier=false -e CI=true \
  -v "$parent:/work" -v "$ROOT/demo:/pages:ro" -w /work "$NODE_IMAGE" bash -c "
    npx --yes nuxi@${NUXI_VERSION} init ${name} --template minimal --packageManager npm --no-gitInit --no-install \
    && cp -a /pages/. ${name}/ \
    && cd ${name} && npm install --no-audit --no-fund && npm run build \
    && node -e \"for (const p of ['nuxt', 'vue', 'vue-router', 'nitropack']) console.log(p, require('./node_modules/' + p + '/package.json').version)\"
  " < /dev/null

echo "Built the demo into $DEMO_DIR/.output"
