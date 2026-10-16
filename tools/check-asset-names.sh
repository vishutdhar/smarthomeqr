#!/bin/sh
# vercel.json caches a file under images/ or fonts/ for a year, as immutable, only when its name
# carries the first 8 hex digits of its SHA-256 (name.1a2b3c4d.ext). That is safe only while every
# such name matches its content and the pages use only such names. This script checks both.
# Changed an image? Run: shasum -a 256 <file> | cut -c1-8, rename the file, update the references.
set -eu
cd "$(dirname "$0")/.."
fail=0
for f in images/* fonts/*; do
  name=$(basename "$f")
  hash=$(printf '%s\n' "$name" | sed -nE 's/^.+\.([0-9a-f]{8})\.[a-z0-9]+$/\1/p')
  [ -n "$hash" ] || continue
  actual=$(shasum -a 256 "$f" | cut -c1-8)
  if [ "$hash" != "$actual" ]; then
    echo "stale name: $f holds content $actual"
    fail=1
  fi
done
for r in $(grep -ohE '(images|fonts)/[A-Za-z0-9._-]*[A-Za-z0-9_-]' index.html privacy.html style.css tools/og.html | sort -u); do
  case "$r" in
    *.[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f].*) ;;
    *) echo "unhashed reference: $r"; fail=1 ;;
  esac
  if [ ! -f "$r" ]; then
    echo "missing file: $r"
    fail=1
  fi
done
if [ "$fail" -eq 0 ]; then
  echo "asset names ok"
fi
exit "$fail"
