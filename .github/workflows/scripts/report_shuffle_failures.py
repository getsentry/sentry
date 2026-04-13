#!/usr/bin/env python3
"""Aggregate per-shard failure artifacts and write a job summary.

Called by the 'report' job after all shuffle-tests-across-shards matrix shards finish.
Each shard uploads a failure.json on failure; this script collects them all, deduplicates
by test node ID, and writes a consolidated markdown summary.

Usage:
    python3 report_shuffle_failures.py [failures-dir]

Arguments:
    failures-dir  Directory containing failure-N/ subdirs each with a failure.json.
                  Defaults to ./failures.

Failure JSON schema:
    type            "flaky" | "pollution"
    testid          pytest node ID of the failing test
    sha             git SHA of the sentry commit under test
    run_url         URL of the GitHub Actions workflow run
    longrepr        (flaky only) pytest long traceback string
    polluting_testid  (pollution only) node ID of the test that caused pollution
    pollution_body  (pollution only) pre-formatted issue body text

Environment:
    GITHUB_STEP_SUMMARY  Path to the step summary file (set by GitHub Actions).
    RUN_URL              Workflow run URL for the summary header.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

MAX_TRACEBACK_LINES = 50


def load_failures(failures_dir: Path) -> list[dict]:
    """Find and parse all failure.json files under failures_dir."""
    if not failures_dir.is_dir():
        return []
    failures = []
    for path in sorted(failures_dir.rglob("failure.json")):
        try:
            data = json.loads(path.read_text())
        except Exception as e:
            print(f"WARNING: skipping {path}: {e}", file=sys.stderr)
            continue
        if "testid" not in data or "type" not in data:
            print(f"WARNING: skipping {path}: missing required fields", file=sys.stderr)
            continue
        failures.append(data)
    return failures


def deduplicate(failures: list[dict]) -> list[dict]:
    """Remove duplicate testids, keeping the first occurrence."""
    seen: set[str] = set()
    result = []
    for f in failures:
        if f["testid"] not in seen:
            seen.add(f["testid"])
            result.append(f)
    return result


def truncate_traceback(text: str, max_lines: int = MAX_TRACEBACK_LINES) -> str:
    lines = text.splitlines()
    if len(lines) <= max_lines:
        return text
    return "\n".join(lines[:max_lines]) + f"\n... ({len(lines) - max_lines} more lines)"


def build_summary(failures: list[dict], run_url: str) -> str:
    """Return a markdown string suitable for appending to GITHUB_STEP_SUMMARY."""
    flaky = [f for f in failures if f["type"] == "flaky"]
    pollution = [f for f in failures if f["type"] == "pollution"]

    lines: list[str] = [
        "## Shuffle Test Failures",
        "",
        f"Run: {run_url}",
        "",
    ]
    if flaky:
        lines.append(f"**{len(flaky)} flaky test(s)**")
    if pollution:
        lines.append(f"**{len(pollution)} test pollution case(s)**")
    lines.append("")

    for f in pollution:
        polluter = f.get("polluting_testid")
        if polluter:
            summary_line = (
                f"<details><summary><code>{f['testid']}</code>"
                f" — polluted by <code>{polluter}</code></summary>"
            )
            body = f.get("pollution_body", "")
        else:
            # Simple isolation detection: test passes alone but fails in shuffle.
            summary_line = (
                f"<details><summary><code>{f['testid']}</code>"
                f" — passes in isolation (likely pollution)</summary>"
            )
            body = f.get("longrepr", "No traceback available")
        lines += [
            summary_line,
            "",
            body,
            "",
            "</details>",
            "",
        ]

    for f in flaky:
        tb = truncate_traceback(f.get("longrepr") or "No traceback available")
        lines += [
            f"<details><summary><code>{f['testid']}</code></summary>",
            "",
            "```",
            tb,
            "```",
            "",
            "</details>",
            "",
        ]

    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    failures_dir = Path(args[0]) if args else Path("failures")

    raw = load_failures(failures_dir)
    if not raw:
        msg = "No failure artifacts found (job may have failed before tests ran).\n"
        summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary_path:
            with open(summary_path, "a") as fh:
                fh.write(msg)
        else:
            print(msg)
        return 0

    failures = deduplicate(raw)
    run_url = os.environ.get("RUN_URL", "")
    summary = build_summary(failures, run_url)

    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a") as fh:
            fh.write(summary)
    else:
        print(summary)

    return 0


if __name__ == "__main__":
    sys.exit(main())
