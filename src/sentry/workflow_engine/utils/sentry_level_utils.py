import logging
from collections.abc import Generator
from contextlib import contextmanager
from typing import Any, Literal

import sentry_sdk

from sentry.workflow_engine.utils.exception_grouping import exception_grouping_context

logger = logging.getLogger(__name__)


# sentry_sdk doesn't export these.
_Event = Any
_ExcInfo = Any

SentryLevel = Literal["error", "warning", "info"]


@contextmanager
def set_sentry_exception_levels(
    exception_levels: dict[type[BaseException], SentryLevel],
) -> Generator[None]:
    """
    Context manager that sets up a Sentry error processor to set
    specific exception types to configured Sentry levels.

    Args:
        exception_levels: Map of exception type to their desired Sentry levels
        Note that type matching is done by equality, not isinstance.
    """

    def process_error(event: _Event, exc_info: _ExcInfo) -> _Event | None:
        exc = exc_info[1]
        exc_type = type(exc)

        # Check if this exception type should have its level overridden
        if exc_type in exception_levels:
            new_level = exception_levels[exc_type]
            event["level"] = new_level

        return event

    with sentry_sdk.new_scope() as scope:
        scope.add_error_processor(process_error)
        yield


@contextmanager
def quiet_redis_noise() -> Generator[None]:
    """
    Context manager that sets up a Sentry error processor to quiet Redis noise.
    Specifically, the current library versions report TimeoutError and MovedError
    internally even when they're being appropriately handled, and it's incorrect for
    those to be treated as errors in Sentry.
    """
    from redis.exceptions import TimeoutError
    from rediscluster.exceptions import (  # type: ignore[attr-defined]
        MovedError,
        RedisClusterException,
    )

    with (
        exception_grouping_context({RedisClusterException: "redis.redis_cluster_exception"}),
        set_sentry_exception_levels({TimeoutError: "info", MovedError: "info"}),
    ):
        yield
