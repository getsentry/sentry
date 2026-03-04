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
    os.environ["SENTRY_SKIP_SERVICE_VALIDATION"] = "1"

    from django.conf import settings

    for alias, test_name in DATABASES.items():
        if alias == "default":
            settings.DATABASES["default"]["NAME"] = test_name
        else:
            settings.DATABASES[alias] = settings.DATABASES["default"].copy()
            settings.DATABASES[alias]["NAME"] = test_name

    settings.DATABASE_ROUTERS = ("sentry.db.router.TestSiloMultiDatabaseRouter",)

    if pg_host.startswith("/"):
        for db_cfg in settings.DATABASES.values():
            db_cfg["HOST"] = pg_host
            db_cfg["PORT"] = ""

    from sentry.runner import configure

    configure()

    from django.core.management import call_command

    start = time.monotonic()
    for alias in DATABASES:
        call_command("migrate", database=alias, verbosity=0, interactive=False, run_syncdb=True)
    return time.monotonic() - start


def _close_all_connections() -> None:
    from django.db import connections

    connections.close_all()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workers", type=int, required=True, help="Number of xdist workers")
    parser.add_argument("--pg-host", default="127.0.0.1")
    parser.add_argument("--pg-port", default="5432")
    parser.add_argument("--pg-user", default="postgres")
    args = parser.parse_args()

    t0 = time.monotonic()

    # Step 1: create template databases
    print("Step 1: Creating template databases")
    for name in DATABASES.values():
        if not _create_db(name, args.pg_host, args.pg_port, args.pg_user):
            return 1

    # Step 2: run Django migrations on templates
    print("Step 2: Running migrations")
    elapsed = _run_migrations(args.pg_host, args.pg_port)
    print(f"  Migrations completed in {elapsed:.1f}s")

    # Must close connections before TEMPLATE copy (postgres requirement)
    _close_all_connections()

    # Step 3: clone for each xdist worker
    print(f"Step 3: Cloning for {args.workers} workers")
    clone_start = time.monotonic()
    for i in range(args.workers):
        for name in DATABASES.values():
            target = f"{name}_gw{i}"
            if not _create_db(target, args.pg_host, args.pg_port, args.pg_user, template=name):
                return 1
    print(f"  Cloned {args.workers * len(DATABASES)} databases in {time.monotonic() - clone_start:.1f}s")

    print(f"\nTotal: {time.monotonic() - t0:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
