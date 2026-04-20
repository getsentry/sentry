#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

GCS_PATH = "gs://getsentry-coverage-data/latest/.coverage.combined"
COVERAGE_FILENAME = ".coverage.combined"
CACHE_DIR = Path.home() / ".cache" / "sentry" / "coverage" / "latest"


def check_gcloud() -> None:
    if shutil.which("gcloud") is None:
        print("Error: gcloud is not installed.", file=sys.stderr)
        print(
            "Install the Google Cloud CLI: https://cloud.google.com/sdk/docs/install",
            file=sys.stderr,
        )
        print("  macOS (Homebrew): brew install --cask google-cloud-sdk", file=sys.stderr)
        sys.exit(1)


def check_auth() -> None:
    result = subprocess.run(
        ["gcloud", "auth", "print-access-token"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        print("Error: Not authenticated with gcloud.", file=sys.stderr)
        print("", file=sys.stderr)
        print("To authenticate, run:", file=sys.stderr)
        print("  gcloud auth login", file=sys.stderr)
        print("  gcloud config set project sentry-dev-tooling", file=sys.stderr)
        print("", file=sys.stderr)
        print(
            "You'll need access to the 'sentry-dev-tooling' GCP project.",
            file=sys.stderr,
        )
        print(
            "Request access in #discuss-dev-infra if you don't have it.",
            file=sys.stderr,
        )
        sys.exit(1)


def get_remote_generation() -> str | None:
    """Return the GCS object generation number, used to detect staleness."""
    result = subprocess.run(
        ["gcloud", "storage", "ls", "-l", GCS_PATH],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return None
    # Output format: "  <size>  <created>  gs://..."
    for line in result.stdout.splitlines():
        parts = line.split()
        if len(parts) >= 3 and parts[-1].startswith("gs://"):
            return parts[1]  # creation/update timestamp as cache key
    return None


def download_coverage(output_path: Path) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached_file = CACHE_DIR / COVERAGE_FILENAME
    generation_file = CACHE_DIR / ".generation"

    remote_gen = get_remote_generation()

    if cached_file.exists() and remote_gen and generation_file.exists():
        if generation_file.read_text().strip() == remote_gen:
            print(f"Using cached coverage data (generation {remote_gen})")
            output_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(cached_file, output_path)
            return

    print(f"Downloading coverage data from {GCS_PATH}...")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    result = subprocess.run(
        ["gcloud", "storage", "cp", GCS_PATH, str(output_path)],
        check=False,
    )
    if result.returncode != 0:
        print("Error: Failed to download coverage database from GCS.", file=sys.stderr)
        sys.exit(1)

    shutil.copy2(output_path, cached_file)
    if remote_gen:
        generation_file.write_text(remote_gen)
    print(f"Coverage database written to {output_path}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fetch latest coverage data from GCS for selective testing"
    )
    parser.add_argument(
        "--output",
        default=".cache/coverage.db",
        help="Output path for the coverage database (default: .cache/coverage.db)",
    )
    args = parser.parse_args()

    check_gcloud()
    check_auth()
    download_coverage(Path(args.output))
    return 0


if __name__ == "__main__":
    sys.exit(main())
