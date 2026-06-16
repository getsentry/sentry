#!/usr/bin/env python3
"""Parse the GitHub PR files API response into changed files and previous filenames.

Reads JSON from stdin (the output of `gh api .../pulls/N/files --paginate`).
Note: --paginate can emit multiple JSON arrays (one per page), so we handle
concatenated arrays by decoding incrementally.

Outputs two lines (suitable for appending to $GITHUB_OUTPUT):
  files=<space-separated filenames>
  previous-filenames=<space-separated old names for renamed files>

Usage:
    gh api repos/OWNER/REPO/pulls/N/files --paginate \
      | python3 parse-pr-files.py >> "$GITHUB_OUTPUT"
"""

from __future__ import annotations

import json
import sys


def main() -> None:
    raw = sys.stdin.read()
    decoder = json.JSONDecoder()
    files = []
    idx = 0
    while idx < len(raw):
        while idx < len(raw) and raw[idx].isspace():
            idx += 1
        if idx >= len(raw):
            break
        obj, end = decoder.raw_decode(raw, idx)
        if isinstance(obj, list):
            files.extend(obj)
        idx = end

    changed = [f["filename"] for f in files]
    previous = [
        f["previous_filename"]
        for f in files
        if f.get("status") == "renamed" and f.get("previous_filename")
    ]

    print(f"files={' '.join(changed)}")
    print(f"previous-filenames={' '.join(previous)}")


if __name__ == "__main__":
    main()
