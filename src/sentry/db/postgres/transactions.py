from __future__ import annotations

import contextlib
import sys
import threading

from django.conf import settings
from django.db import transaction

from sentry.silo.patches.silo_aware_transaction_patch import determine_using_by_silo_mode


@contextlib.contextmanager
def django_test_transaction_water_mark(using: str | None = None):
    """
    Hybrid cloud outbox flushing depends heavily on transaction.on_commit logic, but our tests do not follow
    production in terms of isolation (TestCase users two outer transactions, and stubbed RPCs cannot simulate
    transactional isolation without breaking other test case assumptions).  Therefore, in order to correctly
    simulate transaction.on_commit semantics, use this context in any place where we "simulate" inter transaction
    work that in tests should behave that way.

    This method has no effect in production.
    """
    if "pytest" not in sys.modules:
        yield
        return

    from sentry.testutils import hybrid_cloud

    using = determine_using_by_silo_mode(using)

    connection = transaction.get_connection(using)

    prev = hybrid_cloud.simulated_transaction_watermarks.state.get(using, -1)
    hybrid_cloud.simulated_transaction_watermarks.state[using] = (
        len(connection.savepoint_ids) if connection.in_atomic_block else -1
    )
    try:
        connection.maybe_flush_commit_hooks()
        yield
    finally:
        hybrid_cloud.simulated_transaction_watermarks.state[using] = min(
            len(connection.savepoint_ids) if connection.in_atomic_block else -1, prev
        )


class InTestTransactionEnforcement(threading.local):
    enabled = True


in_test_transaction_enforcement = InTestTransactionEnforcement()


@contextlib.contextmanager
def in_test_hide_transaction_boundary():
    """
    In production, has no effect.
    In tests, it hides 'in_test_assert_no_transaction' invocations against problematic code paths.
    Using this function is a huge code smell, often masking some other code smell, but not always possible to avoid.
    """
    if "pytest" not in sys.modules:
        yield
        return

    prev = in_test_transaction_enforcement.enabled
    in_test_transaction_enforcement.enabled = False
    try:
        yield
    finally:
        in_test_transaction_enforcement.enabled = prev


def in_test_assert_no_transaction(msg: str):
    """
    In production, has no effect.
    In tests, asserts that the current call is not inside of any transaction.
    If you are getting bitten by calls to this function in tests, move your service calls outside of any active
    transaction -- they can't realistically share the wrapping transaction, and in the worst case the indefinite
    execution time can have cause major performance issues by holding transactional resources open for long periods
    of time.
    """
    if "pytest" not in sys.modules or not in_test_transaction_enforcement.enabled:
        return

    from sentry.testutils import hybrid_cloud

    for using in settings.DATABASES:
        conn = transaction.get_connection(using)
        watermark = hybrid_cloud.simulated_transaction_watermarks.state.get(using, -1)
        if watermark < 0:
            assert not conn.in_atomic_block, msg
        else:
            assert len(conn.savepoint_ids) <= watermark, msg
