import logging
from collections.abc import Generator
from contextlib import contextmanager

from sentry.utils.circuit_breaker2 import CircuitBreaker

logger = logging.getLogger("sentry.sentry_apps.circuit_breaker")


@contextmanager
def circuit_breaker_tracking(
    breaker: CircuitBreaker | None,
) -> Generator[None]:
    """Track request outcome: record_error on WebhookTimeoutError, record_success on normal exit.

    Handles the None case as a no-op so callers don't need nullcontext().
    """
    from sentry.utils.sentry_apps.webhooks import WebhookTimeoutError

    if breaker is None:
        yield
        return
    try:
        yield

    # Currently we only count WebhookTimeoutError as an error in the circuit breaker as those operations are the ones that are taking too long
    # If an app returns a say 500, in a reasonable time that's okay
    except WebhookTimeoutError:
        # This is gross but we don't want to propagate a redis or circuit breaker error to the webhook code
        try:
            breaker.record_error()
        except Exception:
            logger.exception("sentry_apps.circuit_breaker.record_error.failure")
        raise
    else:
        try:
            breaker.record_success()
        except Exception:
            logger.exception("sentry_apps.circuit_breaker.record_success.failure")
