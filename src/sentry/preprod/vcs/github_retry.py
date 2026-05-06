from __future__ import annotations

import logging
import time
from collections.abc import Callable
from typing import TypeVar

from sentry.shared_integrations.exceptions import (
    ApiConnectionResetError,
    ApiError,
    ApiRateLimitedError,
)
from sentry.utils import metrics

logger = logging.getLogger(__name__)

T = TypeVar("T")

RETRYABLE_STATUS_CODES = frozenset({429, 500, 502, 503, 504})


def _is_retryable(exc: Exception) -> bool:
    if isinstance(exc, (ApiRateLimitedError, ApiConnectionResetError)):
        return True
    if isinstance(exc, ApiError) and exc.code and exc.code in RETRYABLE_STATUS_CODES:
        return True
    if isinstance(exc, (ConnectionError, TimeoutError)):
        return True
    return False


def _error_tags(exc: Exception) -> dict[str, str]:
    tags: dict[str, str] = {"error_type": type(exc).__name__}
    if isinstance(exc, ApiError) and exc.code:
        tags["status_code"] = str(exc.code)
    return tags


def github_api_call_with_retries(
    fn: Callable[[], T],
    *,
    max_attempts: int = 3,
    log_prefix: str = "preprod.github_retry",
) -> T:
    for attempt in range(1, max_attempts + 1):
        try:
            result = fn()
        except Exception as e:
            if attempt == max_attempts or not _is_retryable(e):
                if attempt > 1:
                    metrics.incr(
                        "preprod.github_retry.exhausted",
                        tags={"caller": log_prefix, **_error_tags(e)},
                        sample_rate=1.0,
                    )
                raise

            delay = 2**attempt
            tags = {"caller": log_prefix, **_error_tags(e)}
            metrics.incr(
                "preprod.github_retry.retried",
                tags={**tags, "attempt": str(attempt)},
                sample_rate=1.0,
            )
            logger.warning(
                "%s.retrying",
                log_prefix,
                extra={
                    "attempt": attempt,
                    "max_attempts": max_attempts,
                    "delay_seconds": delay,
                    **tags,
                },
            )

            time.sleep(delay)
        else:
            if attempt > 1:
                metrics.incr(
                    "preprod.github_retry.success_after_retry",
                    tags={"caller": log_prefix, "attempts": str(attempt)},
                    sample_rate=1.0,
                )
            return result

    raise AssertionError("unreachable")
