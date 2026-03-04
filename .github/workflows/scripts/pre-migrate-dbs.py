#!/usr/bin/env python3
"""Pre-create and migrate test databases for pytest-xdist workers.

Creates template databases (test_region, test_control, test_secondary),
runs Django migrations on them, then clones for each xdist worker using
CREATE DATABASE ... TEMPLATE (filesystem-level copy, sub-second).

This eliminates the per-worker migration cost (~50s per shard) that
normally happens inside pytest's django_db_setup fixture.

Usage:
    python3 pre-migrate-dbs.py --workers 3 --pg-host /tmp/pg-sock
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time

DATABASES = {"default": "test_region", "control": "test_control", "secondary": "test_secondary"}


def _psql(sql: str, host: str, port: str, user: str) -> subprocess.CompletedProcess[str]:
    cmd = ["psql", "-U", user, "-d", "postgres", "-tAc", sql]
    if host.startswith("/"):
        cmd.extend(["-h", host])
    else:
        cmd.extend(["-h", host, "-p", port])
    return subprocess.run(cmd, capture_output=True, text=True)


def _db_exists(name: str, host: str, port: str, user: str) -> bool:
    r = _psql(f"SELECT 1 FROM pg_database WHERE datname='{name}'", host, port, user)
    return "1" in r.stdout


def _create_db(name: str, host: str, port: str, user: str, template: str | None = None) -> bool:
    if _db_exists(name, host, port, user):
        print(f"  {name}: already exists")
        return True
    sql = f'CREATE DATABASE "{name}"'
    if template:
        sql += f' TEMPLATE "{template}"'
    r = _psql(sql, host, port, user)
    if r.returncode != 0:
        print(f"  {name}: FAILED — {r.stderr.strip()}", file=sys.stderr)
        return False
    label = f" (cloned from {template})" if template else ""
    print(f"  {name}: created{label}")
    return True


def _run_migrations(pg_host: str, pg_port: str) -> float:
    """Migrate test_region via `sentry django migrate` subprocess.

    Using subprocess avoids Sentry's chicken-and-egg problem: module-level
    code needs options registered by initialize_app(), but initialize_app()
    makes ORM queries that fail on an empty database. The `sentry` CLI
    handles this correctly by running configure() → setup() → migrate()
    in the right order on a database that already exists (we created it
    in step 1).

    We only migrate test_region. test_control and test_secondary are
    cloned from it via TEMPLATE — all three have identical schemas because
    Django runs all migrations on each database regardless of the router.
    """
    if pg_host.startswith("/"):
        db_url = f"postgres://postgres@/{DATABASES['default']}?host={pg_host}"
    else:
        db_url = f"postgres://postgres@{pg_host}:{pg_port}/{DATABASES['default']}"

    env = {
        **os.environ,
        "DATABASE_URL": db_url,
        "SENTRY_SKIP_SERVICE_VALIDATION": "1",
    }

    start = time.monotonic()
    result = subprocess.run(
        ["sentry", "django", "migrate", "--noinput", "-v", "0"],
        env=env,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"  Migration failed:\n{result.stderr}", file=sys.stderr)
        return -1
    return time.monotonic() - start


def _close_all_connections(host: str, port: str, user: str) -> None:
    """Disconnect all backends from template DBs so TEMPLATE copy can proceed."""
    for name in DATABASES.values():
        _psql(
            f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
            f"WHERE datname='{name}' AND pid <> pg_backend_pid()",
            host,
            port,
            user,
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workers", type=int, required=True, help="Number of xdist workers")
    parser.add_argument("--pg-host", default="127.0.0.1")
    parser.add_argument("--pg-port", default="5432")
    parser.add_argument("--pg-user", default="postgres")
    args = parser.parse_args()

    t0 = time.monotonic()
    h, p, u = args.pg_host, args.pg_port, args.pg_user

    # Step 1: create the primary template database
    print("Step 1: Creating template database")
    primary = DATABASES["default"]
    if not _create_db(primary, h, p, u):
        return 1

    # Step 2: run Django migrations on it
    print("Step 2: Running migrations")
    elapsed = _run_migrations(args.pg_host, args.pg_port)
    if elapsed < 0:
        return 1
    print(f"  Migrations completed in {elapsed:.1f}s")

    # Step 3: clone primary → control + secondary templates
    print("Step 3: Cloning control + secondary from primary")
    _close_all_connections(h, p, u)
    for alias in ("control", "secondary"):
        if not _create_db(DATABASES[alias], h, p, u, template=primary):
            return 1

    # Step 4: clone all templates for each xdist worker
    print(f"Step 4: Cloning for {args.workers} workers")
    _close_all_connections(h, p, u)
    clone_start = time.monotonic()
    for i in range(args.workers):
        for name in DATABASES.values():
            target = f"{name}_gw{i}"
            if not _create_db(target, h, p, u, template=name):
                return 1
    print(f"  Cloned {args.workers * len(DATABASES)} databases in {time.monotonic() - clone_start:.1f}s")

    print(f"\nTotal: {time.monotonic() - t0:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
