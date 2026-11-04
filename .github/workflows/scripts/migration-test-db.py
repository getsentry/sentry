#!/usr/bin/env python3
"""Save and restore the migrated test databases used by the migration tests.

With --reuse-db, pytest keeps a restored database and only applies the
migrations added since it was dumped, instead of running every migration.

Usage: migration-test-db.py save|restore DIR
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import BinaryIO

POSTGRES_CONTAINER = "postgres-postgres-1"
POSTGRES_USER = "postgres"
# Django's test names for the region, control and secondary databases.
TEST_DATABASES = ("test_region", "test_control", "test_secondary")
MIGRATION_GLOB = "src/**/migrations/*.py"
MANIFEST = "migrations.txt"

REPO_ROOT = Path(__file__).resolve().parents[3]


def migration_files() -> set[str]:
    return {str(p.relative_to(REPO_ROOT)) for p in REPO_ROOT.glob(MIGRATION_GLOB)}


def postgres(*args: str, stdin: BinaryIO | None = None, stdout: BinaryIO | None = None) -> None:
    subprocess.run(
        ["docker", "exec", "-i", POSTGRES_CONTAINER, *args], check=True, stdin=stdin, stdout=stdout
    )


def save(cache_dir: Path) -> None:
    cache_dir.mkdir(parents=True, exist_ok=True)
    for db in TEST_DATABASES:
        with open(cache_dir / f"{db}.dump", "wb") as f:
            postgres("pg_dump", "-U", POSTGRES_USER, "--format=custom", db, stdout=f)
    (cache_dir / MANIFEST).write_text("\n".join(sorted(migration_files())))


def restore(cache_dir: Path) -> None:
    manifest = cache_dir / MANIFEST
    if not manifest.is_file():
        print("No saved databases; pytest will build them.")
        return

    # A dump with migrations this checkout lacks (e.g. a branch behind master)
    # can't be migrated forward, so build from scratch instead.
    missing = set(manifest.read_text().split()) - migration_files()
    if missing:
        print(f"Saved databases include {len(missing)} unknown migrations; pytest will build them.")
        return

    for db in TEST_DATABASES:
        postgres("createdb", "-U", POSTGRES_USER, db)
        with open(cache_dir / f"{db}.dump", "rb") as f:
            postgres("pg_restore", "-U", POSTGRES_USER, "--dbname", db, stdin=f)


def main() -> None:
    commands = {"save": save, "restore": restore}
    if len(sys.argv) != 3 or sys.argv[1] not in commands:
        sys.exit(__doc__)
    commands[sys.argv[1]](Path(sys.argv[2]))


if __name__ == "__main__":
    main()
