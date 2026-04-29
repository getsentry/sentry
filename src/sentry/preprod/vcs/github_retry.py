from __future__ import annotations

import logging
import time
from collections.abc import Callable
from typing import TypeVar

from sentry.shared_integrations.exceptions import ApiError, ApiRateLimitedError

logger = logging.getLogger(__name__)

T = TypeVar("T")

RETRYABLE_STATUS_CODES = frozenset({429, 500, 502, 503, 504})


def _is_retryable(exc: Exception) -> bool:
    if isinstance(exc, ApiRateLimitedError):
        return True
    if isinstance(exc, ApiError) and exc.code and exc.code in RETRYABLE_STATUS_CODES:
        return True
    if isinstance(exc, (ConnectionError, TimeoutError, OSError)):
        return True
    return False


def github_api_call_with_retries(
    fn: Callable[[], T],
    *,
    max_attempts: int = 3,
    log_prefix: str = "preprod.github_retry",
) -> T:
    for attempt in range(1, max_attempts + 1):
        try:
            return fn()
        except Exception as e:
            if attempt == max_attempts or not _is_retryable(e):
                raise

            delay = 2**attempt
            extra = {
                "attempt": attempt,
                "max_attempts": max_attempts,
                "delay_seconds": delay,
                "error_type": type(e).__name__,
            }
            if isinstance(e, ApiError):
                extra["status_code"] = e.code
            logger.warning("%s.retrying", log_prefix, extra=extra)

            time.sleep(delay)

    raise Exception("unreachable")
