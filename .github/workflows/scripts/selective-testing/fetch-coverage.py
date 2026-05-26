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


def ensure_gcloud_authed() -> None:
    if shutil.which("gcloud") is None:
        raise SystemExit(
            """\
Error: gcloud is not installed.

Make sure you've run `direnv allow`.

Install the Google Cloud CLI: https://cloud.google.com/sdk/docs/install
  macOS (Homebrew): brew install --cask google-cloud-sdk"""
        )

    # gcloud config config-helper exits 1 if there is no active account,
    # and also prompts for yubikey 2FA if it needs refreshing.
    result = subprocess.run(
        ["gcloud", "config", "config-helper"],
        capture_output=True,
        check=False,
    )
    if result.returncode == 0:
        return

    subprocess.run(
        ["gcloud", "auth", "login", "--activate", "--update-adc"],
        check=False,
    )

    # Check again, and if something's still wrong then exit.
    result = subprocess.run(
        ["gcloud", "config", "config-helper"],
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit(
            """\
Error: Not authenticated with gcloud.

To authenticate, run:
  gcloud auth login"""
        )


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
        raise SystemExit("Error: Failed to download coverage database from GCS.")

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

    ensure_gcloud_authed()
    download_coverage(Path(args.output))
    return 0


if __name__ == "__main__":
    sys.exit(main())
