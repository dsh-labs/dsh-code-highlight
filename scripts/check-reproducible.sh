#!/usr/bin/env bash
# Build twice from a clean dist/ and fail if the output differs.
set -euo pipefail
hash_dist() { (cd dist && find . -type f -print0 | sort -z | xargs -0 shasum -a 256); }
rm -rf dist && pnpm run build >/dev/null 2>&1 && first="$(hash_dist)"
rm -rf dist && pnpm run build >/dev/null 2>&1 && second="$(hash_dist)"
if [ "$first" != "$second" ]; then
  echo "::error::build output is not reproducible"
  diff <(echo "$first") <(echo "$second") || true
  exit 1
fi
echo "$first"
echo "build output reproducible"
