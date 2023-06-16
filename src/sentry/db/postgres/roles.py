from __future__ import annotations

import contextlib
import os
import sys

from django.db.transaction import get_connection


@contextlib.contextmanager
def in_test_psql_role_override(role_name: str, using: str | None = None):
    """
    During test runs, the role of the current connection will be swapped with role_name, and then swapped
    back to its original.  Has no effect in production.
    """

    if "pytest" not in sys.modules or os.environ.get("DB", "postgres") != "postgres":
        yield
        return

    with get_connection(using).cursor() as conn:
        conn.execute("SELECT user")
        (cur,) = conn.fetchone()
        conn.execute("SET ROLE %s", [role_name])
        try:
            yield
        finally:
            conn.execute("SET ROLE %s", [cur])
