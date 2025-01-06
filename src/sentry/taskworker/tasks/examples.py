from __future__ import annotations

import logging

from sentry.taskworker.registry import taskregistry
from sentry.taskworker.retry import LastAction, Retry, RetryError

logger = logging.getLogger(__name__)

exampletasks = taskregistry.create_namespace(name="examples")


@exampletasks.register(name="examples.say_hello")
def say_hello(name: str) -> None:
    logger.info("Hello %s", name)


@exampletasks.register(
    name="examples.retry_deadletter", retry=Retry(times=2, times_exceeded=LastAction.Deadletter)
)
def retry_deadletter() -> None:
    raise RetryError


@exampletasks.register(
    name="examples.will_retry",
    retry=Retry(times=3, on=(RuntimeError,), times_exceeded=LastAction.Discard),
)
def will_retry(failure: str) -> None:
    if failure == "retry":
        logger.info("going to retry with explicit retry error")
        raise RetryError
    if failure == "raise":
        logger.info("raising runtimeerror")
        raise RuntimeError("oh no")
    logger.info("got %s", failure)


@exampletasks.register(name="examples.simple_task")
def simple_task() -> None:
    logger.info("simple_task complete")


@exampletasks.register(name="examples.retry_task", retry=Retry(times=2))
def retry_task() -> None:
    raise RetryError


@exampletasks.register(name="examples.fail_task")
def fail_task() -> None:
    raise ValueError("nope")


@exampletasks.register(name="examples.at_most_once", at_most_once=True)
def at_most_once_task() -> None:
    pass
