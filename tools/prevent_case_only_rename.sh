#!/usr/bin/env bash
# Reject staged case-only renames (Foo.tsx -> foo.tsx).
# These break macOS case-insensitive checkouts when casing drifts across branches.
# check-case-conflict only catches two distinct paths that collide when lowercased.
set -euo pipefail

git diff --cached -M --name-status | awk -F '\t' '
  $1 ~ /^R/ && tolower($2) == tolower($3) && $2 != $3 {
    print "case-only rename forbidden:", $2, "->", $3
    err = 1
  }
  END { exit err + 0 }
'
