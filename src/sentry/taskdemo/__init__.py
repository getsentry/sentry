from __future__ import annotations

import logging
import time
from multiprocessing.context import TimeoutError

logger = logging.getLogger(__name__)

from sentry.conf.types.kafka_definition import Topic
from sentry.taskworker.config import taskregistry
from sentry.taskworker.retry import Retry

demotasks = taskregistry.create_namespace(
    name="demos",
    topic=Topic.HACKWEEK.value,
    deadletter_topic=Topic.HACKWEEK_DLQ.value,
)


@demotasks.register(name="demos.say_hello")
def say_hello(name):
    # logger.info("hello %s", name) need to fix logging now that we are running this in another process
    print(f"hello {name}")  # noqa


@demotasks.register(name="demos.raise_timeout", retry=Retry(times=3))
def raise_timeout(name):
    # logger.info("hello %s", name) need to fix logging now that we are running this in another process
    print(f"raising timeout: {name}")  # noqa
    raise TimeoutError


@demotasks.register(name="demos.variable_time")
def variable_time(wait=None, taskno=None):
    logger.info("running task %s with %s delay", taskno, wait)
    if wait is not None:
        time.sleep(wait)


@demotasks.register(name="demos.broken", retry=Retry(times=5, on=(KeyError,)))
def broken(runtime: str):
    """Do something or raise an error"""
    if runtime == "boom":
        raise ValueError("it went boom")
    if runtime == "safeboom":
        raise KeyError("it went safeboom retry")
    logger.info("runtime %s", runtime)
