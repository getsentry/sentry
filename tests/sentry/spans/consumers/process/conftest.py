import pytest
import sentry_sdk


@pytest.fixture(autouse=True)
def _reset_sentry_isolation_scope():
    """Reset isolation scope level after tests to prevent pollution.

    SpanFlusher.main() and ProcessSpansStrategyFactory.create_with_partitions()
    set scope.level = "warning" on the shared isolation scope. In tests the
    flusher runs as a thread (not a separate process), so this leaks into
    subsequent tests.
    """
    yield
    sentry_sdk.get_isolation_scope()._level = None
