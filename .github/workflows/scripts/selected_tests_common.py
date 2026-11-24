"""Shared by the backend and acceptance test selectors.

compute-sentry-selected-tests.py and compute-acceptance-selected-tests.py both
map changed Python files to tests with per-test coverage, recorded with
--cov-context=test, and both run the whole suite for the files listed here.
"""

from __future__ import annotations

import re
import sqlite3

# Most of these won't have coverage info because they're evaluated at
# module load time and app warmup, before any per-test coverage context is active.
#
# Tracking a "startup" coverage context doesn't work: django.setup()
# eagerly imports models, fields, validators, utils, etc. We also have
# large dynamic __init__'s so a startup context would select nearly every
# test.
PYTHON_FULL_SUITE_TRIGGERS: list[str | re.Pattern[str]] = [
    re.compile(r"^src/sentry/testutils/pytest/"),
    re.compile(r"(^|/)conftest\.py$"),
    "src/sentry/runner/initializer.py",
    "src/sentry/constants.py",
    # column-alias enum evaluated at import time; used indirectly by every
    # Snuba query builder so coverage never records per-test contexts for it
    "src/sentry/snuba/events.py",
    # pure constants/aliases consumed at module level by search field/function
    # registries — same pattern as constants.py, coverage sees only startup context
    "src/sentry/search/events/constants.py",
    # EAP shared column/aggregate definitions; consumed at import time by every
    # EAP dataset file via module-level list comprehensions — zero coverage data
    "src/sentry/search/eap/common_columns.py",
    "src/sentry/search/eap/common_aggregates.py",
    # option defaults registered at startup via initialize_app()
    re.compile(r"^src/sentry/options/"),
    # feature flags registered via manager.add() at import time
    re.compile(r"^src/sentry/features/"),
    # audit log events registered via default_manager.add() at import time;
    # 60+ test files consume this via `from sentry import audit_log` (parent-package
    # import), which the static import scan can't detect — so targeted mapping is
    # unsafe and the full suite is required
    re.compile(r"^src/sentry/audit_log/"),
    # signal definitions created at module level; receivers depend on these
    "src/sentry/signals.py",
    # signal handlers registered globally via initialize_receivers()
    re.compile(r"^src/sentry/receivers/"),
    # stdlib/third-party monkey-patches applied before Django setup
    re.compile(r"^src/sentry/monkey/"),
    # monkeypatches transaction.atomic for silo-aware DB routing
    re.compile(r"^src/sentry/silo/patches/"),
    # SiloRouter loaded via DATABASE_ROUTERS; affects every DB query
    "src/sentry/db/router.py",
    "src/sentry/conf/server.py",
    "src/sentry/web/urls.py",
    "pyproject.toml",
    "uv.lock",
    re.compile(r"/migrations/\d{4}_[^/]+\.py$"),
]


def matches_trigger(file_path: str, trigger: str | re.Pattern[str]) -> bool:
    if isinstance(trigger, re.Pattern):
        return trigger.search(file_path) is not None
    return file_path == trigger


def covering_contexts(
    coverage_db_path: str, file_paths: list[str], context_like: str = "_%"
) -> dict[str, set[str]]:
    """Test contexts that ran lines of each file, matched by path suffix.

    Files that the database has no data for are left out of the result.
    """
    conn = sqlite3.connect(coverage_db_path)
    try:
        cur = conn.cursor()

        tables = {
            r[0]
            for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        }
        if "line_bits" not in tables or "context" not in tables:
            raise ValueError(
                "Coverage database missing line_bits/context tables. "
                "Coverage must be collected with --cov-context=test"
            )

        covered: dict[str, set[str]] = {}
        for file_path in file_paths:
            cur.execute(
                """
                SELECT c.context, lb.numbits
                FROM line_bits lb
                JOIN file f    ON lb.file_id = f.id
                JOIN context c ON lb.context_id = c.id
                WHERE f.path LIKE '%' || ?
                  AND c.context LIKE ?
            """,
                (file_path, context_like),
            )
            rows = cur.fetchall()
            if rows:
                covered[file_path] = {
                    context for context, bitblob in rows if any(b != 0 for b in bytes(bitblob))
                }
    finally:
        conn.close()
    return covered
