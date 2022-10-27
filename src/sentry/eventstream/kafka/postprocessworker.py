import logging
import random
from concurrent.futures import Future, ThreadPoolExecutor, as_completed
from contextlib import contextmanager
from enum import Enum
from typing import Any, Generator, Mapping, Optional, Sequence

from sentry import options
from sentry.eventstream.base import GroupStates
from sentry.eventstream.kafka.protocol import (
    get_task_kwargs_for_message,
    get_task_kwargs_for_message_from_headers,
)
from sentry.tasks.post_process import post_process_group
from sentry.utils import metrics
from sentry.utils.batching_kafka_consumer import AbstractBatchWorker
from sentry.utils.cache import cache_key_for_event

logger = logging.getLogger(__name__)

Message = Any
_DURATION_METRIC = "eventstream.duration"
_MESSAGES_METRIC = "eventstream.messages"


class PostProcessForwarderType(str, Enum):
    ERRORS = "errors"
    TRANSACTIONS = "transactions"


@contextmanager
def _sampled_eventstream_timer(instance: str) -> Generator[None, None, None]:
    record_metric = random.random() < 0.1
    if record_metric is True:
        with metrics.timer(_DURATION_METRIC, instance=instance):
            yield
    else:
        yield


def _get_task_kwargs(message: Message) -> Optional[Mapping[str, Any]]:
    use_kafka_headers = options.get("post-process-forwarder:kafka-headers")

    if use_kafka_headers:
        try:
            with _sampled_eventstream_timer(instance="get_task_kwargs_for_message_from_headers"):
                return get_task_kwargs_for_message_from_headers(message.headers())
        except Exception as error:
            logger.error("Could not forward message: %s", error, exc_info=True)
            with metrics.timer(_DURATION_METRIC, instance="get_task_kwargs_for_message"):
                return get_task_kwargs_for_message(message.value())
    else:
        with metrics.timer(_DURATION_METRIC, instance="get_task_kwargs_for_message"):
            return get_task_kwargs_for_message(message.value())


def _record_metrics(partition: int, task_kwargs: Mapping[str, Any]) -> None:
    event_type = "transactions" if task_kwargs["group_id"] is None else "errors"
    metrics.incr(
        _MESSAGES_METRIC,
        tags={"partition": partition, "type": event_type},
    )


def dispatch_post_process_group_task(
    event_id: str,
    project_id: int,
    group_id: Optional[int],
    is_new: bool,
    is_regression: Optional[bool],
    is_new_group_environment: bool,
    primary_hash: Optional[str],
    queue: str,
    skip_consume: bool = False,
    group_states: Optional[GroupStates] = None,
) -> None:
    if skip_consume:
        logger.info("post_process.skip.raw_event", extra={"event_id": event_id})
    else:
        cache_key = cache_key_for_event({"project": project_id, "event_id": event_id})

        post_process_group.apply_async(
            kwargs={
                "is_new": is_new,
                "is_regression": is_regression,
                "is_new_group_environment": is_new_group_environment,
                "primary_hash": primary_hash,
                "cache_key": cache_key,
                "group_id": group_id,
                "group_states": group_states,
            },
            queue=queue,
        )


def _get_task_kwargs_and_dispatch(message: Message) -> None:
    task_kwargs = _get_task_kwargs(message)
    if not task_kwargs:
        return None

    _record_metrics(message.partition(), task_kwargs)
    dispatch_post_process_group_task(**task_kwargs)


class PostProcessForwarderWorker(AbstractBatchWorker):
    """
    Implementation of the AbstractBatchWorker which would be used for post process forwarder.
    The current implementation creates a thread pool worker based on the concurrency parameter
    because we want to be able to change the concurrency during runtime. This should be replaced
    by a thread pool executor once stress tests experiments are over and we start using the
    CLI arguments to set concurrency.
    """

    def __init__(self, concurrency: Optional[int] = 1) -> None:
        logger.info(f"Starting post process forwarder with {concurrency} threads")
        self.__executor = ThreadPoolExecutor(max_workers=concurrency)

    def process_message(self, message: Message) -> Optional[Future]:
        """
        Process the message received by the consumer and return the Future associated with the message. The future
        is stored in the batch of batching_kafka_consumer and provided as an argument to flush_batch. If None is
        returned, the batching_kafka_consumer will not add the return value to the batch.
        """
        return self.__executor.submit(_get_task_kwargs_and_dispatch, message)

    def flush_batch(self, batch: Optional[Sequence[Future]]) -> None:
        """
        For all work which was submitted to the thread pool executor, we need to ensure that if an exception was
        raised, then we raise it in the main thread. This is needed so that processing can be stopped in such
        cases.
        """
        if batch:
            for future in as_completed(batch):
                exc = future.exception()
                if exc is not None:
                    raise exc

    def shutdown(self) -> None:
        self.__executor.shutdown()
