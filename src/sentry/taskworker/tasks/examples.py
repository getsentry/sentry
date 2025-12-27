from __future__ import annotations

import logging
from time import sleep
from typing import Any

from sentry.taskworker.constants import CompressionType
from sentry.taskworker.namespaces import exampletasks
from sentry.taskworker.retry import LastAction, NoRetriesRemainingError, Retry, RetryTaskError
from sentry.taskworker.retry import retry_task as retry_task_helper
from sentry.utils.redis import redis_clusters

logger = logging.getLogger(__name__)


@exampletasks.register(name="examples.say_hello")
def say_hello(name: str, *args: list[Any], **kwargs: dict[str, Any]) -> None:
    logger.debug("Hello %s", name)


@exampletasks.register(
    name="examples.retry_deadletter", retry=Retry(times=2, times_exceeded=LastAction.Deadletter)
)
def retry_deadletter() -> None:
    raise RetryTaskError


@exampletasks.register(
    name="examples.retry_state", retry=Retry(times=2, times_exceeded=LastAction.Deadletter)
)
def retry_state() -> None:
    try:
        retry_task_helper()
    except NoRetriesRemainingError:
        redis = redis_clusters.get("default")
        redis.set("no-retries-remaining", 1)


@exampletasks.register(
    name="examples.will_retry",
    retry=Retry(times=3, on=(RuntimeError,), times_exceeded=LastAction.Discard),
)
def will_retry(failure: str) -> None:
    if failure == "retry":
        logger.debug("going to retry with explicit retry error")
        raise RetryTaskError
    if failure == "raise":
        logger.debug("raising runtimeerror")
        raise RuntimeError("oh no")
    logger.debug("got %s", failure)


@exampletasks.register(name="examples.simple_task")
def simple_task(*args: list[Any], **kwargs: dict[str, Any]) -> None:
    sleep(60)
    # logger.debug("simple_task complete")
    print("simple_task HELLO!")


@exampletasks.register(
    name="examples.simple_task_with_processing_deadline", processing_deadline_duration=30
)
def simple_task_with_processing_deadline(*args: list[Any], **kwargs: dict[str, Any]) -> None:
    sleep(0.1)
    logger.debug("simple_task complete")


@exampletasks.register(name="examples.simple_task_wait_delivery", wait_for_delivery=True)
def simple_task_wait_delivery() -> None:
    logger.debug("simple_task_wait_delivery complete")


@exampletasks.register(name="examples.retry_task", retry=Retry(times=2))
def retry_task() -> None:
    raise RetryTaskError


@exampletasks.register(name="examples.fail_task")
def fail_task() -> None:
    raise ValueError("nope")


@exampletasks.register(name="examples.at_most_once", at_most_once=True)
def at_most_once_task() -> None:
    pass


@exampletasks.register(name="examples.timed")
def timed_task(sleep_seconds: float | str, *args: list[Any], **kwargs: dict[str, Any]) -> None:
    sleep(float(sleep_seconds))
    logger.debug("timed_task complete")


# @exampletasks.register(name="examples.simple_task", compression_type=CompressionType.ZSTD)
# def simple_task_compressed(*args: list[Any], **kwargs: dict[str, Any]) -> None:
#     sleep(0.1)
#     logger.debug("simple_task_compressed complete")
