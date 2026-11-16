#!/usr/bin/env python3
"""List changed files and previous filenames for selective testing.

By default, reads JSON from stdin (the output of `gh api .../pulls/N/files --paginate`).
Note: --paginate can emit multiple JSON arrays (one per page), so we handle
concatenated arrays by decoding incrementally.

With `--git-diff BASE HEAD`, diffs two local commits instead, for merge groups,
which have no pull request to ask the API about.

Outputs two lines (suitable for appending to $GITHUB_OUTPUT):
  files=<space-separated filenames>
  previous-filenames=<space-separated old names for renamed files>

Both lists are empty, which consumers treat as "run the full suite", when the
PR is too large to select tests from: the API stops listing files at 3000, and
a long list can't be passed on as a single env var or workflow dispatch input.

Usage:
    gh api repos/OWNER/REPO/pulls/N/files --paginate \
      | python3 parse-pr-files.py >> "$GITHUB_OUTPUT"
    python3 parse-pr-files.py --git-diff BASE HEAD >> "$GITHUB_OUTPUT"
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections.abc import Sequence

# The pulls/files API returns at most this many files, so the list may be incomplete.
MAX_API_FILES = 3000
# GitHub's workflow_dispatch inputs limit, well below Linux's 128 KiB limit on one env var.
MAX_LIST_LENGTH = 65_535


def _api_files() -> list[dict[str, str]]:
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
    return files


def _git_diff_files(base: str, head: str) -> list[dict[str, str]]:
    """Read `git diff --name-status` into the API response fields that main() uses."""
    out = subprocess.run(
        ("git", "diff", "--name-status", "-z", "-M", base, head),
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    # -z ends every field with NUL. Renames and copies carry the old path before
    # the new one, other changes carry only the path.
    fields = out.split("\0")[:-1]
    files = []
    idx = 0
    while idx < len(fields):
        status = fields[idx]
        if status[0] in "RC":
            files.append(
                {
                    "status": "renamed" if status[0] == "R" else status,
                    "previous_filename": fields[idx + 1],
                    "filename": fields[idx + 2],
                }
            )
            idx += 3
        else:
            files.append({"status": status, "filename": fields[idx + 1]})
            idx += 2
    return files


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--git-diff", nargs=2, metavar=("BASE", "HEAD"))
    args = parser.parse_args(argv)

    files = _git_diff_files(*args.git_diff) if args.git_diff else _api_files()

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
