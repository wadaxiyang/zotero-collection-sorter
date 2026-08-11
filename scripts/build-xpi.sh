#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

version="$(node -p "require('./manifest.json').version")"
output_dir="${OUTPUT_DIR:-dist}"
output_file="$output_dir/zotero-collection-sorter-$version.xpi"

mkdir -p "$output_dir"
zip -X -FS -r "$output_file" \
  manifest.json \
  bootstrap.js \
  prefs.js \
  src \
  _locales \
  assets/collection-sorter-icon.svg \
  assets/icon-48.png \
  assets/icon-96.png \
  >/dev/null

printf '%s\n' "$output_file"
