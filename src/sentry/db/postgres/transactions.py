import contextlib
import sys

from django.db import transaction


@contextlib.contextmanager
def django_test_transaction_water_mark(using: str = "default"):
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

    # No need to manage the watermark unless conftest has configured a watermark
    if using not in hybrid_cloud.simulated_transaction_watermarks:
        yield
        return

    prev = hybrid_cloud.simulated_transaction_watermarks[using]
    hybrid_cloud.simulated_transaction_watermarks[using] = len(
        transaction.get_connection(using).savepoint_ids
    )
    try:
        yield
    finally:
        hybrid_cloud.simulated_transaction_watermarks[using] = prev


def in_test_assert_no_transaction(msg: str):
    """
    In production, has no effect.
    In tests, asserts that the current call is not inside of any transaction.
    If you are getting bitten by calls to this function in tests, move your service calls outside of any active
    transaction -- they can't realistically share the wrapping transaction, and in the worst case the indefinite
    execution time can have cause major performance issues by holding transactional resources open for long periods
    of time.
    """
    if "pytest" not in sys.modules:
        return

    from sentry.testutils import hybrid_cloud

    for using, watermark in hybrid_cloud.simulated_transaction_watermarks.items():
        assert len(transaction.get_connection(using).savepoint_ids) == watermark, msg
