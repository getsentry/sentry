#!/usr/bin/env python3
"""Extract test info from a GitHub Actions job URL for detect-test-pollution."""

from __future__ import annotations

import os
import re
import subprocess
import sys


def parse_job_url(url: str) -> tuple[str, str, str, str]:
    """Parse owner, repo, run_id, job_id from a GitHub Actions job URL.

    Example: https://github.com/getsentry/sentry/actions/runs/21654747518/job/62427093320
    """
    m = re.match(
        r"https://github\.com/([^/]+)/([^/]+)/actions/runs/(\d+)/job/(\d+)",
        url,
    )
    if not m:
        print(f"Could not parse URL: {url}", file=sys.stderr)
        print(
            "Expected format: https://github.com/OWNER/REPO/actions/runs/RUN_ID/job/JOB_ID",
            file=sys.stderr,
        )
        sys.exit(1)
    return m.group(1), m.group(2), m.group(3), m.group(4)


def gh_api(endpoint: str) -> str:
    """Call the GitHub API via gh CLI and return raw text."""
    result = subprocess.run(
        ["gh", "api", endpoint],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout


def main() -> int:
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <github-actions-job-url>", file=sys.stderr)
        return 1

    url = sys.argv[1]
    owner, repo, run_id, job_id = parse_job_url(url)
    print(f"Parsed URL - owner: {owner}, repo: {repo}, run: {run_id}, job: {job_id}")

    # Download the raw job logs (single API call - all values are extracted from here)
    print("Downloading job logs...")
    logs = gh_api(f"repos/{owner}/{repo}/actions/jobs/{job_id}/logs")

    # Strip ANSI color codes (PY_COLORS=1 in CI wraps text like FAILED in escape sequences)
    logs = re.sub(r"\x1b\[[0-9;]*[a-zA-Z]", "", logs)

    # Extract SENTRY_REVISION from the setup-sentry action output
    # setup-sentry runs with -ux and prints: echo SENTRY_RELEASE=ci@<sha>
    sentry_revision = None
    m = re.search(r"SENTRY_RELEASE=ci@([0-9a-f]{40})", logs)
    if m:
        sentry_revision = m.group(1)

    # Extract TEST_GROUP (set by setup-sentry: echo "TEST_GROUP=$MATRIX_INSTANCE" >> $GITHUB_ENV)
    test_group = None
    m = re.search(r"TEST_GROUP=(\d+)", logs)
    if m:
        test_group = m.group(1)

    # Extract TOTAL_TEST_GROUPS (set by setup-sentry: echo "TOTAL_TEST_GROUPS=$MATRIX_INSTANCE_TOTAL" >> $GITHUB_ENV)
    total_test_groups = None
    m = re.search(r"TOTAL_TEST_GROUPS=(\d+)", logs)
    if m:
        total_test_groups = m.group(1)

    # Extract SENTRY_SHUFFLE_TESTS_SEED
    # The pytest plugin prints: "SENTRY_SHUFFLE_TESTS_SEED: {seed}"
    shuffle_seed = None
    m = re.search(r"SENTRY_SHUFFLE_TESTS_SEED: (\d+)", logs)
    if not m:
        # Fall back to env var format
        m = re.search(r"SENTRY_SHUFFLE_TESTS_SEED=(\d+)", logs)
    if m:
        shuffle_seed = m.group(1)

    # Find the first failing test
    # pytest short summary: FAILED tests/sentry/path.py::TestClass::test_method - ...
    flaky_test = None
    m = re.search(r"FAILED (tests/\S+::\S+)", logs)
    if not m:
        # Also check for ERROR (test errors, not just assertion failures)
        m = re.search(r"ERROR (tests/\S+::\S+)", logs)
    if m:
        flaky_test = m.group(1)

    # Report
    print("\nExtracted values:")
    print(f"  SENTRY_REVISION:          {sentry_revision}")
    print(f"  TEST_GROUP:               {test_group}")
    print(f"  TOTAL_TEST_GROUPS:        {total_test_groups}")
    print(f"  SENTRY_SHUFFLE_TESTS_SEED: {shuffle_seed}")
    print(f"  FLAKY_TEST:               {flaky_test}")

    # Validate
    missing = []
    if sentry_revision is None:
        missing.append("SENTRY_REVISION")
    if test_group is None:
        missing.append("TEST_GROUP")
    if total_test_groups is None:
        missing.append("TOTAL_TEST_GROUPS")
    if shuffle_seed is None:
        missing.append("SENTRY_SHUFFLE_TESTS_SEED")
    if flaky_test is None:
        missing.append("FLAKY_TEST (no failed test found)")

    if missing:
        print(f"\nERROR: Could not extract: {', '.join(missing)}", file=sys.stderr)
        return 1

    # Export to GITHUB_OUTPUT
    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output:
        with open(github_output, "a") as f:
            f.write(f"SENTRY_REVISION={sentry_revision}\n")
            f.write(f"TEST_GROUP={test_group}\n")
            f.write(f"TOTAL_TEST_GROUPS={total_test_groups}\n")
            f.write(f"SENTRY_SHUFFLE_TESTS_SEED={shuffle_seed}\n")
            f.write(f"FLAKY_TEST={flaky_test}\n")
        print("\nExported values to GITHUB_OUTPUT")
    else:
        print("\nGITHUB_OUTPUT not set (not running in CI), skipping export")

    return 0


if __name__ == "__main__":
    sys.exit(main())
