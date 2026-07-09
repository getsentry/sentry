from __future__ import annotations

import logging
import random
from time import sleep
from typing import Any

from arroyo.backends.kafka import FutureTrackingProducer, KafkaPayload, KafkaProducer
from arroyo.types import Topic
from taskbroker_client.constants import CompressionType
from taskbroker_client.retry import LastAction, NoRetriesRemainingError, Retry, RetryTaskError
from taskbroker_client.retry import retry_task as retry_task_helper

from sentry.taskworker.namespaces import exampletasks
from sentry.utils.redis import redis_clusters

logger = logging.getLogger(__name__)


@exampletasks.register(name="examples.say_hello")
def say_hello(name: str, *args: list[Any], **kwargs: dict[str, Any]) -> None:
    logger.debug("Hello %s", name)


@exampletasks.register(
    name="examples.retry_deadletter",
    retry=Retry(times=2, times_exceeded=LastAction.Deadletter),
)
def retry_deadletter() -> None:
    raise RetryTaskError


@exampletasks.register(
    name="examples.retry_state",
    retry=Retry(times=2, times_exceeded=LastAction.Deadletter),
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
    sleep(0.1)
    logger.debug("simple_task complete")


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


@exampletasks.register(name="examples.simple_task", compression_type=CompressionType.ZSTD)
def simple_task_compressed(*args: list[Any], **kwargs: dict[str, Any]) -> None:
    sleep(0.1)
    logger.debug("simple_task_compressed complete")


@exampletasks.register(name="examples.simple_task_with_random_duration")
def simple_task_with_random_duration(
    distribution: str, a: float, b: float, *args: list[Any], **kwargs: dict[str, Any]
) -> None:
    """
    Runs tasks that sleep for a random duration, based on the distribution and the parameters.
    For uniform distribution, the parameters are the minimum and maximum duration.
    For gauss distribution, the parameters are the mean and standard deviation.
    For exponential distribution, the first parameter is the lambda (lambd is 1.0 divided by the desired mean).
    """
    if distribution == "uniform":
        if a > b or a < 0 or b < 0:
            raise ValueError(f"Invalid parameters for uniform distribution: a={a}, b={b}")
        sleep(random.uniform(a, b))
    elif distribution == "gauss":
        sleep(max(0, random.normalvariate(mu=a, sigma=b)))  # random.gauss isn't threadsafe
    elif distribution == "exponential":
        if a <= 0:
            raise ValueError(f"Invalid parameter for exponential distribution: a={a}")
        sleep(random.expovariate(lambd=a))
    else:
        raise ValueError(f"Invalid distribution: {distribution}")
    logger.debug("simple_task_with_random_duration complete")


@exampletasks.register(name="examples.task_that_produces")
def task_that_produces(
    payload: bytes,
    destination_topic: str = "test-topic",
    bootstrap_servers: str = "localhost:9092",
    production_count: int = 1,
    random_count: bool = False,
) -> None:
    assert production_count > 0

    def producer_factory() -> KafkaProducer:
        return KafkaProducer({"bootstrap.servers": bootstrap_servers})

    producer = FutureTrackingProducer("test.producer", producer_factory)
    production_count = random.randint(1, production_count) if random_count else production_count
    for i in range(production_count):
        logger.debug(f"Producing message {i} onto topic {destination_topic}...")
        producer.produce(
            dest=Topic(destination_topic),
            payload=KafkaPayload(key=None, value=payload, headers=[]),
        )
