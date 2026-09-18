#!/usr/bin/env python3
"""Parse the GitHub PR files API response into changed files and previous filenames.

Reads JSON from stdin (the output of `gh api .../pulls/N/files --paginate`).
Note: --paginate can emit multiple JSON arrays (one per page), so we handle
concatenated arrays by decoding incrementally.

By default, outputs two lines suitable for appending to $GITHUB_OUTPUT:
  files=<space-separated filenames>
  previous-filenames=<space-separated old names for renamed files>

With --output-directory, writes the values to files instead. This avoids
expanding large lists into a subsequent process's environment.

Usage:
    gh api repos/OWNER/REPO/pulls/N/files --paginate \
      | python3 parse-pr-files.py >> "$GITHUB_OUTPUT"
    gh api repos/OWNER/REPO/pulls/N/files --paginate \
      | python3 parse-pr-files.py --output-directory "$RUNNER_TEMP"
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-directory", type=Path)
    return parser.parse_args(argv)


def main(argv: list[str]) -> None:
    args = parse_args(argv)
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

    changed_value = " ".join(changed)
    previous_value = " ".join(previous)
    if args.output_directory:
        args.output_directory.mkdir(parents=True, exist_ok=True)
        (args.output_directory / "sentry-changed-files").write_text(changed_value)
        (args.output_directory / "sentry-previous-filenames").write_text(previous_value)
    else:
        print(f"files={changed_value}")
        print(f"previous-filenames={previous_value}")


if __name__ == "__main__":
    main(sys.argv[1:])
