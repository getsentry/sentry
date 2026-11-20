#!/usr/bin/env python3
"""Parse the GitHub PR files API response into changed files and previous filenames.

Reads JSON from stdin (the output of `gh api .../pulls/N/files --paginate`).
Note: --paginate can emit multiple JSON arrays (one per page), so we handle
concatenated arrays by decoding incrementally.

Outputs two lines (suitable for appending to $GITHUB_OUTPUT):
  files=<space-separated filenames>
  previous-filenames=<space-separated old names for renamed files>

Both lists are empty, which consumers treat as "run the full suite", when the
PR is too large to select tests from: the API stops listing files at 3000, and
a long list can't be passed on as a single env var or workflow dispatch input.

Usage:
    gh api repos/OWNER/REPO/pulls/N/files --paginate \
      | python3 parse-pr-files.py >> "$GITHUB_OUTPUT"
"""

from __future__ import annotations

import json
import sys

# The pulls/files API returns at most this many files, so the list may be incomplete.
MAX_API_FILES = 3000
# GitHub's workflow_dispatch inputs limit, well below Linux's 128 KiB limit on one env var.
MAX_LIST_LENGTH = 65_535


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

    changed_str = " ".join(changed)
    previous_str = " ".join(previous)
    if len(files) >= MAX_API_FILES or len(changed_str) + len(previous_str) > MAX_LIST_LENGTH:
        print(
            f"{len(files)} changed files is too many to select tests from; running the full suite",
            file=sys.stderr,
        )
        changed_str = previous_str = ""

    print(f"files={changed_str}")
    print(f"previous-filenames={previous_str}")


if __name__ == "__main__":
    main()
