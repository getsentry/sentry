#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# ///
"""
Classify PR files as noise or substantive for scraps migration reviews.

Usage:
    uv run classify_pr_files.py <pr> [--repo OWNER/REPO] [--mark-viewed]

Output: JSON to stdout with structured classification data.
"""

from __future__ import annotations

import argparse
import json  # noqa: S003
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor  # noqa: S016
from typing import Any

NOISE_PATTERNS = [
    re.compile(r"^[-+]\s*(import\b|from\s+['\"]|}\s+from\s+['\"])"),
    re.compile(r"^[-+]\s*$"),
]

KNOWN_NOISE_FILES = [
    ".github/codeowners-coverage-baseline.txt",
    "tests/js/sentry-test/snapshots/",
]


def get_pr_diff(pr: str, repo: str) -> str:
    result = subprocess.run(
        ["gh", "pr", "diff", pr, "--repo", repo],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout


def get_pr_node_id(pr: str, repo: str) -> str:
    result = subprocess.run(
        ["gh", "pr", "view", pr, "--repo", repo, "--json", "id", "--jq", ".id"],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def parse_file_diffs(diff: str) -> dict[str, list[str]]:
    """Split a unified diff into per-file hunks."""
    files: dict[str, list[str]] = {}
    current_file: str | None = None
    current_lines: list[str] = []

    for line in diff.splitlines():
        if line.startswith("diff --git"):
            if current_file:
                files[current_file] = current_lines
            match = re.search(r" b/(.+)$", line)
            current_file = match.group(1) if match else None
            current_lines = [line]
        elif current_file is not None:
            current_lines.append(line)

    if current_file:
        files[current_file] = current_lines
    return files


def find_destination_dir(file_diffs: dict[str, list[str]]) -> str | None:
    """Detect the scraps core destination directory from rename pairs."""
    for path, lines in file_diffs.items():
        if "static/app/components/core/" in path:
            for line in lines:
                if line.startswith("rename from"):
                    parts = path.split("/")
                    idx = parts.index("core") + 2
                    return "/".join(parts[:idx]) + "/"
    return None


def classify_file(path: str, lines: list[str], destination_dir: str | None) -> dict[str, Any]:
    """Classify a single file as noise or substantive."""
    if destination_dir and path.startswith(destination_dir):
        return {"path": path, "classification": "substantive", "reason": "destination-dir"}

    for pattern in KNOWN_NOISE_FILES:
        if path.startswith(pattern) or path == pattern:
            return {"path": path, "classification": "noise", "reason": "known-noise-file"}

    added = [ln for ln in lines if ln.startswith("+") and not ln.startswith("+++")]
    removed = [ln for ln in lines if ln.startswith("-") and not ln.startswith("---")]

    if not added and not removed:
        return {"path": path, "classification": "substantive", "reason": "pure-rename"}

    for line in added + removed:
        if not line[1:].strip():
            continue
        if any(p.match(line) for p in NOISE_PATTERNS):
            continue
        return {"path": path, "classification": "substantive", "reason": "has-substantive-changes"}

    return {"path": path, "classification": "noise", "reason": "import-only"}


def mark_files_viewed(pr_node_id: str, paths: list[str]) -> int:
    def mark_one(path: str) -> bool:
        query = (
            "mutation { markFileAsViewed(input: "
            f'{{pullRequestId: "{pr_node_id}", path: "{path}"}}'
            ") { pullRequest { id } } }"
        )
        result = subprocess.run(
            ["gh", "api", "graphql", "-f", f"query={query}"],
            capture_output=True,
            text=True,
        )
        return result.returncode == 0

    with ThreadPoolExecutor(max_workers=10) as pool:
        results = list(pool.map(mark_one, paths))
    return sum(results)


def main() -> None:
    parser = argparse.ArgumentParser(description="Classify PR files for scraps review")
    parser.add_argument("pr", help="PR number or URL")
    parser.add_argument("--repo", default="getsentry/sentry")
    parser.add_argument(
        "--mark-viewed", action="store_true", help="Mark noise files as viewed on GitHub"
    )
    args = parser.parse_args()

    pr = args.pr
    url_match = re.search(r"github\.com/([^/]+/[^/]+)/pull/(\d+)", pr)
    if url_match:
        args.repo = url_match.group(1)
        pr = url_match.group(2)

    diff = get_pr_diff(pr, args.repo)
    file_diffs = parse_file_diffs(diff)
    destination_dir = find_destination_dir(file_diffs)

    files = [classify_file(path, lines, destination_dir) for path, lines in file_diffs.items()]
    noise = [f for f in files if f["classification"] == "noise"]
    substantive = [f for f in files if f["classification"] == "substantive"]

    marked = 0
    if args.mark_viewed and noise:
        pr_node_id = get_pr_node_id(pr, args.repo)
        marked = mark_files_viewed(pr_node_id, [f["path"] for f in noise])

    output = {
        "summary": {
            "total": len(files),
            "noise": len(noise),
            "substantive": len(substantive),
            "marked_viewed": marked,
        },
        "substantive": substantive,
        "noise": noise,
    }

    print(json.dumps(output, indent=2))  # noqa: S002, T201


if __name__ == "__main__":
    main()
