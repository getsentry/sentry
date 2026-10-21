#!/usr/bin/env python3
"""Save and restore the migrated test databases for the migration tests job.

Building the test databases by running every migration from scratch takes
about 4 minutes. A restored dump only needs the migrations added since it was
taken, which pytest-django applies on top because the job runs with
``--reuse-db``.

Usage:
  migration-test-db.py save DIR     Dump the test databases into DIR.
  migration-test-db.py restore DIR  Load the dumps in DIR into empty test databases.

``restore`` drops the restored databases again if they record a migration that
isn't in this checkout. That happens when a PR branch is behind the master
commit that saved the dump; pytest then builds the databases from scratch.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

CONTAINER = "postgres-postgres-1"
DATABASES = ("test_region", "test_control", "test_secondary")
REPO_ROOT = Path(__file__).resolve().parents[3]


def psql(db: str, sql: str) -> str:
    return subprocess.run(
        ["docker", "exec", CONTAINER, "psql", "-U", "postgres", "-d", db, "-Atc", sql],
        check=True,
        capture_output=True,
        text=True,
    ).stdout


def drop(db: str) -> None:
    psql("postgres", f'DROP DATABASE IF EXISTS "{db}"')


def save(cache_dir: Path) -> None:
    cache_dir.mkdir(parents=True, exist_ok=True)
    for db in DATABASES:
        with open(cache_dir / f"{db}.dump", "wb") as f:
            subprocess.run(
                ["docker", "exec", CONTAINER, "pg_dump", "-U", "postgres", "-Fc", db],
                check=True,
                stdout=f,
            )
        print(f"saved {db}")


# Squashed migrations count every migration they replace, since Django records
# those as applied too.
LIST_DISK_MIGRATIONS = """
from django.db.migrations.loader import MigrationLoader

for key, migration in MigrationLoader(None, ignore_no_migrations=True).disk_migrations.items():
    for app, name in (key, *migration.replaces):
        print("migration", app, name)
"""


def migrations_on_disk() -> set[tuple[str, str]]:
    out = subprocess.run(
        ["sentry", "exec", "-c", LIST_DISK_MIGRATIONS],
        check=True,
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
    ).stdout
    return {
        (parts[1], parts[2])
        for parts in (line.split() for line in out.splitlines())
        if len(parts) == 3 and parts[0] == "migration"
    }


def restore(cache_dir: Path) -> None:
    dumps = [cache_dir / f"{db}.dump" for db in DATABASES]
    if not all(d.is_file() for d in dumps):
        print("no complete dump to restore; pytest will build the databases")
        return

    for db, dump in zip(DATABASES, dumps):
        drop(db)
        psql("postgres", f'CREATE DATABASE "{db}"')
        with open(dump, "rb") as f:
            subprocess.run(
                ["docker", "exec", "-i", CONTAINER, "pg_restore", "-U", "postgres", "-d", db],
                check=True,
                stdin=f,
            )

    on_disk = migrations_on_disk()
    known_apps = {app for app, _ in on_disk}
    unknown = sorted(
        {
            f"{app}.{name}"
            for db in DATABASES
            for app, name in (
                line.split("|")
                for line in psql(db, "SELECT app, name FROM django_migrations").splitlines()
            )
            if app in known_apps and (app, name) not in on_disk
        }
    )
    if unknown:
        print(f"dump has migrations missing from this checkout: {', '.join(unknown)}")
        print("dropping it; pytest will build the databases")
        for db in DATABASES:
            drop(db)
        return

    print(f"restored {', '.join(DATABASES)}")


def main() -> None:
    match sys.argv[1:]:
        case ["save", cache_dir]:
            save(Path(cache_dir))
        case ["restore", cache_dir]:
            restore(Path(cache_dir))
        case _:
            sys.exit(f"usage: {os.path.basename(sys.argv[0])} save|restore DIR")


if __name__ == "__main__":
    main()
