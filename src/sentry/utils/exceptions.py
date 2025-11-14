import logging
from collections.abc import Generator, Mapping
from contextlib import contextmanager
from typing import Any, Literal, int

import sentry_sdk

from sentry.taskworker.state import current_task
from sentry.taskworker.workerchild import ProcessingDeadlineExceeded

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
def exception_grouping_context(
    exception_mapping: Mapping[type[BaseException], str], *refinements: str
) -> Generator[None]:
    """
    Context manager that ensures specified exceptions are grouped together on the task level
    using custom fingerprint prefixes.

    Args:
        exception_mapping: Mapping from exception types to their fingerprint prefix strings
        refinements: Additional refinement strings to append to the fingerprint
    """
    task_state = current_task()
    if task_state:

        def process_error(event: _Event, exc_info: _ExcInfo) -> _Event | None:
            exc = exc_info[1]
            for exc_type, fingerprint_prefix in exception_mapping.items():
                if isinstance(exc, exc_type):
                    event["fingerprint"] = [
                        fingerprint_prefix,
                        task_state.namespace,
                        task_state.taskname,
                        *refinements,
                    ]
                    break
            return event

        with sentry_sdk.new_scope() as scope:
            scope.add_error_processor(process_error)
            yield
    else:
        logger.info("No task state found in exception_grouping_context")
        yield


@contextmanager
def timeout_grouping_context(*refinements: str) -> Generator[None]:
    """
    Context manager that ensures that ProcessingDeadlineExceeded errors are grouped together on the task level.
    Grouping based on specific stacktrace is usually inappropriate because once we've past the deadline, any
    subsequent line of code executed may be running when it is raised.
    Defaulting to grouping by task is more accurate, and where there's a need to subdivide that, we
    offer the ability to refine.
    """
    with exception_grouping_context(
        {ProcessingDeadlineExceeded: "task.processing_deadline_exceeded"}, *refinements
    ):
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
        try:
            yield
        except RedisClusterException:
            # RedisClusterException, unlike the others, propagates in most cases, so we
            # want to report it within the grouping context to ensure it is grouped correctly.
            # Unless there's another exception in this execution context in the interim, any
            # top-level reporting should be dropped by the Sentry dupe detection.
            sentry_sdk.capture_exception()
            raise
