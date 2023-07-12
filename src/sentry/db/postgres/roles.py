from __future__ import annotations

import contextlib
import os
import sys
from collections import defaultdict
from typing import MutableMapping

from django.db.transaction import get_connection

from sentry.silo.patches.silo_aware_transaction_patch import determine_using_by_silo_mode

_fencing_counters: MutableMapping[str, int] = defaultdict(int)


@contextlib.contextmanager
def in_test_psql_role_override(role_name: str, using: str | None = None):
    """
    During test runs, the role of the current connection will be swapped with role_name, and then swapped
    back to its original.  Has no effect in production.
    """

    if "pytest" not in sys.argv[0] or os.environ.get("DB", "postgres") != "postgres":
        yield
        return

    using = determine_using_by_silo_mode(using)

    # TODO(mark) Move this closer to other silo code.
    _fencing_counters[using] += 1

    with get_connection(using).cursor() as conn:
        fence_value = _fencing_counters[using]
        conn.execute("SELECT %s", [f"start_role_override_{fence_value}"])
        conn.execute("SELECT user")
        (cur,) = conn.fetchone()
        conn.execute("SET ROLE %s", [role_name])
        try:
            yield
        finally:
            conn.execute("SET ROLE %s", [cur])
            conn.execute("SELECT %s", [f"end_role_override_{fence_value}"])
