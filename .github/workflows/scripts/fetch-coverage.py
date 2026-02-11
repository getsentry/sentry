#!/usr/bin/env python3
from __future__ import annotations

import argparse
import subprocess
import sys
import urllib.request
from pathlib import Path

GCS_BUCKET = "sentry-coverage-data"
GCS_BASE_URL = f"https://storage.googleapis.com/{GCS_BUCKET}"
COVERAGE_FILENAME = ".coverage.combined"
DEFAULT_MAX_COMMITS = 30


def detect_base_ref() -> str:
    """Auto-detect the base ref by checking for origin/master or origin/main."""
    for ref in ("origin/master", "origin/main"):
        result = subprocess.run(
            ["git", "rev-parse", "--verify", ref],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode == 0:
            return ref

    print("Error: Could not find origin/master or origin/main", file=sys.stderr)
    print("Make sure you have fetched from the remote (git fetch origin)", file=sys.stderr)
    sys.exit(1)


def get_commit_list(base_ref: str, max_commits: int) -> list[str]:
    """Get list of commit SHAs to check for coverage data."""
    result = subprocess.run(
        ["git", "rev-list", base_ref, f"--max-count={max_commits}"],
        capture_output=True,
        text=True,
        check=True,
    )
    return [sha.strip() for sha in result.stdout.strip().splitlines() if sha.strip()]


def get_cache_dir() -> Path:
    """Get the cache directory for coverage data."""
    cache_home = Path.home() / ".cache" / "sentry" / "coverage"
    cache_home.mkdir(parents=True, exist_ok=True)
    return cache_home


def check_coverage_exists(sha: str) -> bool:
    """Check if coverage data exists for a commit via HTTP HEAD request."""
    url = f"{GCS_BASE_URL}/{sha}/{COVERAGE_FILENAME}"
    req = urllib.request.Request(url, method="HEAD")
    try:
        urllib.request.urlopen(req, timeout=5)
        return True
    except urllib.error.HTTPError:
        return False
    except urllib.error.URLError as e:
        print(f"  Warning: Network error checking {sha[:12]}: {e}", file=sys.stderr)
        return False


def download_coverage(sha: str, output_path: Path) -> bool:
    """Download coverage database from GCS via HTTP GET."""
    # Check local cache first
    cache_dir = get_cache_dir()
    cached_file = cache_dir / sha / COVERAGE_FILENAME

    if cached_file.exists():
        print(f"Using cached coverage data for {sha[:12]}")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        # Copy from cache (symlink would break if cache is cleaned)
        import shutil

        shutil.copy2(cached_file, output_path)
        return True

    url = f"{GCS_BASE_URL}/{sha}/{COVERAGE_FILENAME}"
    print(f"Downloading coverage data from {sha[:12]}...")

    try:
        urllib.request.urlretrieve(url, str(output_path))
    except (urllib.error.HTTPError, urllib.error.URLError) as e:
        print(f"Error downloading coverage data: {e}", file=sys.stderr)
        return False

    # Cache the download
    cached_file.parent.mkdir(parents=True, exist_ok=True)
    import shutil

    shutil.copy2(output_path, cached_file)
    print(f"Cached coverage data at {cached_file}")

    return True


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch coverage data from GCS for selective testing"
    )
    parser.add_argument(
        "--base-ref",
        help="Base git ref to walk history from (default: auto-detect origin/master or origin/main)",
    )
    parser.add_argument(
        "--output",
        default=".cache/coverage.db",
        help="Output path for the coverage database (default: .cache/coverage.db)",
    )
    parser.add_argument(
        "--max-commits",
        type=int,
        default=DEFAULT_MAX_COMMITS,
        help=f"Maximum number of commits to check (default: {DEFAULT_MAX_COMMITS})",
    )
    args = parser.parse_args()

    base_ref = args.base_ref or detect_base_ref()
    output_path = Path(args.output)

    print(f"Looking for coverage data from {base_ref} (up to {args.max_commits} commits)")

    commits = get_commit_list(base_ref, args.max_commits)
    if not commits:
        print("No commits found to check", file=sys.stderr)
        return 2

    for sha in commits:
        print(f"  Checking {sha[:12]}...", end=" ")
        if check_coverage_exists(sha):
            print("found!")
            output_path.parent.mkdir(parents=True, exist_ok=True)
            if download_coverage(sha, output_path):
                print(f"Coverage database written to {output_path}")
                return 0
            else:
                return 1
        else:
            print("no coverage")

    print(f"No coverage data found in last {args.max_commits} commits", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
