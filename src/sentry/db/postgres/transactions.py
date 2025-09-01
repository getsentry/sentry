from __future__ import annotations

import contextlib
import threading

from django.conf import settings
from django.db import connections, transaction
from django.db.transaction import Atomic, get_connection

from sentry.silo.base import SiloMode, SingleProcessSiloModeState
from sentry.utils.env import in_test_environment


@contextlib.contextmanager
def django_test_transaction_water_mark(using: str | None = None):
    """
    Hybrid cloud outbox flushing depends heavily on transaction.on_commit logic, but our tests do not follow
    production in terms of isolation (TestCase uses two outer transactions, and stubbed RPCs cannot simulate
    transactional isolation without breaking other test case assumptions).  Therefore, in order to correctly
    simulate transaction.on_commit semantics, use this context in any place where we "simulate" inter transaction
    work that in tests should behave that way.

    This method has no effect in production.
    """
    if not in_test_environment():
        yield
        return

    if using is None:
        with contextlib.ExitStack() as stack:
            for db_name in settings.DATABASES:
                stack.enter_context(django_test_transaction_water_mark(db_name))
            yield
        return

    from sentry.testutils import hybrid_cloud  # NOQA:S007

    # Exempt get_connection call from silo validation checks
    with (
        SingleProcessSiloModeState.exit(),
        SingleProcessSiloModeState.enter(SiloMode.MONOLITH),
    ):
        connection = transaction.get_connection(using)

    prev = hybrid_cloud.simulated_transaction_watermarks.state.get(using, 0)
    hybrid_cloud.simulated_transaction_watermarks.state[using] = (
        hybrid_cloud.simulated_transaction_watermarks.get_transaction_depth(connection)
    )
    old_run_on_commit = connection.run_on_commit
    connection.run_on_commit = []
    try:
        yield
    finally:
        connection.run_on_commit = old_run_on_commit
        hybrid_cloud.simulated_transaction_watermarks.state[using] = min(
            hybrid_cloud.simulated_transaction_watermarks.get_transaction_depth(connection), prev
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
    if not in_test_environment():
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
    if not in_test_environment() or not in_test_transaction_enforcement.enabled:
        return

    from sentry.testutils import hybrid_cloud  # NOQA:S007

    for conn in connections.all():
        assert not hybrid_cloud.simulated_transaction_watermarks.connection_transaction_depth_above_watermark(
            connection=conn
        ), msg


@contextlib.contextmanager
def enforce_constraints(transaction: Atomic):
    """
    Nested transaction in Django do not check constraints by default, meaning IntegrityErrors can 'float' to callers
    of functions that happen to wrap with additional transaction scopes.  Using this context manager around a transaction
    will force constraints to be checked at the end of that transaction (or savepoint) even if it happens to be nested,
    allowing you to handle the IntegrityError correctly.
    """
    with transaction:
        yield
        get_connection(transaction.using or "default").check_constraints()
