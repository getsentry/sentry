import logging
import time
from collections import deque
from concurrent.futures import Future, ThreadPoolExecutor
from typing import Any, Deque, Mapping, Optional, Tuple

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.abstract import MessageRejected
from arroyo.types import Commit, Message, Partition, Position

from sentry import options
from sentry.eventstream.base import GroupStates
from sentry.eventstream.kafka.postprocessworker import _record_metrics, _sampled_eventstream_timer
from sentry.eventstream.kafka.postprocessworker import (
    dispatch_post_process_group_task as _dispatch_post_process_group_task,
)
from sentry.eventstream.kafka.protocol import (
    get_task_kwargs_for_message,
    get_task_kwargs_for_message_from_headers,
)
from sentry.utils import metrics

_DURATION_METRIC = "eventstream.duration"

logger = logging.getLogger(__name__)


# For testing. Function will eventually move here when postprocessworker is removed.
def dispatch_post_process_group_task(
    event_id: str,
    project_id: int,
    group_id: Optional[int],
    is_new: bool,
    is_regression: Optional[bool],
    is_new_group_environment: bool,
    queue: str,
    primary_hash: Optional[str],
    skip_consume: bool = False,
    group_states: Optional[GroupStates] = None,
) -> None:
    _dispatch_post_process_group_task(
        event_id,
        project_id,
        group_id,
        is_new,
        is_regression,
        is_new_group_environment,
        queue,
        primary_hash,
        skip_consume,
        group_states,
    )


def _get_task_kwargs(message: Message[KafkaPayload]) -> Optional[Mapping[str, Any]]:
    use_kafka_headers = options.get("post-process-forwarder:kafka-headers")

    if use_kafka_headers:
        try:
            with _sampled_eventstream_timer(instance="get_task_kwargs_for_message_from_headers"):
                return get_task_kwargs_for_message_from_headers(message.payload.headers)
        except Exception as error:
            logger.warning("Could not forward message: %s", error, exc_info=True)
            with metrics.timer(_DURATION_METRIC, instance="get_task_kwargs_for_message"):
                return get_task_kwargs_for_message(message.payload.value)
    else:
        with metrics.timer(_DURATION_METRIC, instance="get_task_kwargs_for_message"):
            return get_task_kwargs_for_message(message.payload.value)


def _get_task_kwargs_and_dispatch(message: Message[KafkaPayload]) -> None:
    task_kwargs = _get_task_kwargs(message)
    if not task_kwargs:
        return None

    _record_metrics(message.partition.index, task_kwargs)
    dispatch_post_process_group_task(**task_kwargs)


class DispatchTask(ProcessingStrategy[KafkaPayload]):
    def __init__(
        self,
        concurrency: int,
        max_pending_futures: int,
        commit: Commit,
    ) -> None:
        self.__executor = ThreadPoolExecutor(max_workers=concurrency)
        self.__futures: Deque[Tuple[Message[KafkaPayload], Future[None]]] = deque()
        self.__max_pending_futures = max_pending_futures
        self.__commit = commit
        self.__closed = False

    def submit(self, message: Message[KafkaPayload]) -> None:
        assert not self.__closed
        # The list of pending futures is too long, tell the stream processor to slow down
        if len(self.__futures) > self.__max_pending_futures:
            raise MessageRejected

        self.__futures.append(
            (message, self.__executor.submit(_get_task_kwargs_and_dispatch, message))
        )

    def poll(self) -> None:
        # Remove completed futures in order
        while self.__futures and self.__futures[0][1].done():
            message, _ = self.__futures.popleft()

            self.__commit({message.partition: Position(message.next_offset, message.timestamp)})

    def join(self, timeout: Optional[float] = None) -> None:
        start = time.time()

        # Commit all pending offsets
        self.__commit({}, force=True)

        while self.__futures:
            remaining = timeout - (time.time() - start) if timeout is not None else None
            if remaining is not None and remaining <= 0:
                logger.warning(f"Timed out with {len(self.__futures)} futures in queue")
                break

            message, future = self.__futures.popleft()

            future.result(remaining)

            self.__commit(
                {message.partition: Position(message.next_offset, message.timestamp)}, force=True
            )

        self.__executor.shutdown()

    def close(self) -> None:
        self.__closed = True

    def terminate(self) -> None:
        self.__closed = True
        self.__executor.shutdown()


class PostProcessForwarderStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self,
        concurrency: int,
        max_pending_futures: int,
    ):
        self.__concurrency = concurrency
        self.__max_pending_futures = max_pending_futures

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return DispatchTask(self.__concurrency, self.__max_pending_futures, commit)
