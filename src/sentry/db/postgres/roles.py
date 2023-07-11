from __future__ import annotations


def in_test_psql_role_override(role_name: str, using: str | None = None):
    # Deprecated shim for getsentry compatibility
    from sentry.testutils.silo import unguarded_write

    return unguarded_write(using)
