#!/usr/bin/env bash
# Insert scraped slowgrammers into the remote D1 database.
# Usage: scripts/add-entries.sh entries.json
# entries.json is an array of {handle, display_name, followers, quote, post_url, posted_at}.
# Safe to re-run: post_url is UNIQUE and rows are inserted with INSERT OR IGNORE.
set -euo pipefail

file="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
sql="$(mktemp -t slowgrammers).sql"
trap 'rm -f "$sql"' EXIT

jq -r '
  def q: tostring | gsub("'\''"; "'\'''\''") | "'\''" + . + "'\''";
  .[]
  | select(.followers >= 10000)
  | select(.post_url | test("^https://x\\.com/[A-Za-z0-9_]{1,15}/status/[0-9]+$"))
  | "INSERT OR IGNORE INTO slowgrammers (handle, display_name, followers, quote, post_url, posted_at) VALUES (\(.handle|q), \(.display_name|q), \(.followers|floor), \(.quote|q), \(.post_url|q), \(.posted_at|q));"
' "$file" > "$sql"

# Quotes can contain newlines, so count statements rather than lines.
count="$(grep -c '^INSERT' "$sql" || true)"
if [ "$count" -eq 0 ]; then
  echo "Nothing new to insert"
  exit 0
fi

echo "Inserting up to $count entries (existing post URLs are skipped)"
cd "$(dirname "$0")/.."
npx wrangler d1 execute slowgrammers --remote --file "$sql"
