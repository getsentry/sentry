import logging
import random
from concurrent.futures import Future, ThreadPoolExecutor, as_completed
from contextlib import contextmanager
from enum import Enum
from typing import Any, Generator, Mapping, Optional, Sequence

from sentry import options
from sentry.eventstream.kafka.protocol import (
    decode_bool,
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
_CONCURRENCY_METRIC = "eventstream.concurrency"
_MESSAGES_METRIC = "eventstream.messages"
_CONCURRENCY_OPTION = "post-process-forwarder:concurrency"
_TRANSACTION_FORWARDER_HEADER = "transaction_forwarder"


class PostProcessForwarderType(str, Enum):
    ERRORS = "errors"
    TRANSACTIONS = "transactions"
    ALL = "all"


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
    is_regression: bool,
    is_new_group_environment: bool,
    primary_hash: Optional[str],
    skip_consume: bool = False,
) -> None:
    if skip_consume:
        logger.info("post_process.skip.raw_event", extra={"event_id": event_id})
    else:
        cache_key = cache_key_for_event({"project": project_id, "event_id": event_id})

        post_process_group.delay(
            is_new=is_new,
            is_regression=is_regression,
            is_new_group_environment=is_new_group_environment,
            primary_hash=primary_hash,
            cache_key=cache_key,
            group_id=group_id,
        )


def _get_task_kwargs_and_dispatch(message: Message):
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
        self.__current_concurrency = concurrency
        logger.info(f"Starting post process forwarder with {concurrency} threads")
        metrics.incr(_CONCURRENCY_METRIC, amount=concurrency)
        self.__executor = ThreadPoolExecutor(max_workers=self.__current_concurrency)

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

        # Check if the concurrency settings have changed. If yes, then shutdown the existing executor
        # and create a new one with the new settings
        new_concurrency = options.get(_CONCURRENCY_OPTION)
        if new_concurrency != self.__current_concurrency:
            logger.info(
                f"Switching post-process-forwarder from {self.__current_concurrency} to {new_concurrency} worker threads"
            )
            metrics.incr(_CONCURRENCY_METRIC, amount=new_concurrency)
            self.__executor.shutdown(wait=True)
            self.__executor = ThreadPoolExecutor(max_workers=new_concurrency)
            self.__current_concurrency = new_concurrency

    def shutdown(self) -> None:
        self.__executor.shutdown()


class ErrorsPostProcessForwarderWorker(PostProcessForwarderWorker):
    """
    ErrorsPostProcessForwarderWorker will processes messages only in the following scenarios:
    1. _TRANSACTION_FORWARDER_HEADER is missing from the kafka headers. This is a backward compatibility
    use case. There can be messages in the queue which do not have this header. Those messages should be
    handled by the errors post process forwarder
    2. _TRANSACTION_FORWARDER_HEADER is False in the kafka headers.
    """

    def process_message(self, message: Message) -> Optional[Future]:
        headers = {header: value for header, value in message.headers()}

        # Backwards-compatibility case for messages missing header.
        if _TRANSACTION_FORWARDER_HEADER not in headers:
            return super().process_message(message)

        if decode_bool(headers.get(_TRANSACTION_FORWARDER_HEADER)) is False:
            return super().process_message(message)

        return None


class TransactionsPostProcessForwarderWorker(PostProcessForwarderWorker):
    """
    TransactionsPostProcessForwarderWorker will processes messages only in the following scenarios:
    1. _TRANSACTION_FORWARDER_HEADER is True in the kafka headers.
    """

    def process_message(self, message: Message) -> Optional[Future]:
        headers = {header: value for header, value in message.headers()}

        # Backwards-compatibility for messages missing headers.
        if _TRANSACTION_FORWARDER_HEADER not in headers:
            return None

        if decode_bool(headers.get(_TRANSACTION_FORWARDER_HEADER)) is True:
            return super().process_message(message)

        return None
