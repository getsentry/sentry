from collections.abc import Generator
from contextlib import contextmanager

from sentry.utils.circuit_breaker2 import CircuitBreaker


@contextmanager
def circuit_breaker_tracking(
    breaker: CircuitBreaker | None,
) -> Generator[None]:
    """Track request outcome: record_error on Exception, record_success on normal exit.

    Handles the None case as a no-op so callers don't need nullcontext().
    """
    if breaker is None:
        yield
        return
    try:
        yield
    except Exception:
        breaker.record_error()
        raise
    else:
        breaker.record_success()
