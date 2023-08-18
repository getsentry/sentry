from __future__ import annotations

import contextlib
import re
from collections import defaultdict
from typing import Any, MutableMapping, Optional

from django.db.transaction import get_connection

from sentry.silo.patches.silo_aware_transaction_patch import (
    validate_transaction_using_for_silo_mode,
)
from sentry.utils.env import in_test_environment

_fence_re = re.compile(r"select\s*\'(?P<operation>start|end)_role_override", re.IGNORECASE)
_fencing_counters: MutableMapping[str, int] = defaultdict(int)


def match_fence_query(query: str) -> Optional[re.Match[str]]:
    return _fence_re.match(query)


@contextlib.contextmanager
def unguarded_write(using: str, *args: Any, **kwargs: Any):
    """
    Used to indicate that the wrapped block is safe to do
    mutations on outbox backed records.

    In production this context manager has no effect, but
    in tests it emits 'fencing' queries that are audited at the
    end of each test run by:

    sentry.testutils.silo.validate_protected_queries

    This code can't be co-located with the auditing logic because
    the testutils module cannot be used in production code.
    """
    if not in_test_environment():
        yield
        return

    validate_transaction_using_for_silo_mode(using)

    _fencing_counters[using] += 1

    with get_connection(using).cursor() as conn:
        fence_value = _fencing_counters[using]
        conn.execute("SELECT %s", [f"start_role_override_{fence_value}"])
        try:
            yield
        finally:
            conn.execute("SELECT %s", [f"end_role_override_{fence_value}"])
