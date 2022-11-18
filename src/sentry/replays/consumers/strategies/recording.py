from __future__ import annotations

import concurrent.futures
import logging
import random
import time
from collections import deque
from concurrent.futures import Future
from typing import Callable, Deque, Mapping, MutableMapping, NamedTuple, Optional

import msgpack
import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.types import Message, Partition, Position
from django.conf import settings
from sentry_sdk.tracing import Transaction

from sentry.replays.usecases.ingest import RecordingSegmentMessage, ingest_recording_not_chunked
from sentry.utils import metrics

logger = logging.getLogger("sentry.replays")

COMMIT_FREQUENCY_SEC = 1


class ReplayRecordingMessageFuture(NamedTuple):
    message: Message[KafkaPayload]
    future: Future[None]


class RecordingProcessorStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def create_with_partitions(
        self,
        commit: Callable[[Mapping[Partition, Position]], None],
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RecordingProcessorStrategy(commit)


class RecordingProcessorStrategy(ProcessingStrategy[KafkaPayload]):
    def __init__(
        self,
        commit: Callable[[Mapping[Partition, Position]], None],
    ) -> None:
        self.__closed = False
        self.__commit = commit
        self.__commit_data: MutableMapping[Partition, Position] = {}
        self.__last_committed: float = 0
        self.setup()

    def setup(self):
        self.__futures: Deque[ReplayRecordingMessageFuture] = deque()
        self.__threadpool = concurrent.futures.ThreadPoolExecutor(max_workers=16)

    def teardown(self):
        self.__threadpool.shutdown(wait=False)

    def _process_recording(
        self,
        message_dict: RecordingSegmentMessage,
        message: Message[KafkaPayload],
        current_transaction: Transaction,
    ) -> None:
        self.__futures.append(
            ReplayRecordingMessageFuture(
                message,
                self.__threadpool.submit(
                    ingest_recording_not_chunked,
                    message_dict=message_dict,
                    transaction=current_transaction,
                ),
            )
        )

    @metrics.wraps("replays.process_recording.submit")
    def submit(self, message: Message[KafkaPayload]) -> None:
        assert not self.__closed

        current_transaction = sentry_sdk.start_transaction(
            name="replays.consumer.process_recording",
            op="replays.consumer",
            sampled=random.random()
            < getattr(settings, "SENTRY_REPLAY_RECORDINGS_CONSUMER_APM_SAMPLING", 0),
        )

        try:
            with current_transaction.start_child(op="msg_unpack"):
                message_dict = msgpack.unpackb(message.payload.value)

            self._process_recording(message_dict, message, current_transaction)
        except Exception:
            # avoid crash looping on bad messsages for now
            logger.exception(
                "Failed to process replay recording message", extra={"offset": message.offset}
            )
            current_transaction.finish()

    def close(self) -> None:
        self.__closed = True
        self.teardown()

    def terminate(self) -> None:
        self.close()

    def join(self, timeout: Optional[float] = None) -> None:
        start = time.time()

        # Immediately commit all the offsets we have popped from the queue.
        self.__throttled_commit(force=True)

        # Any remaining items in the queue are flushed until the process is terminated.
        while self.__futures:
            remaining = timeout - (time.time() - start) if timeout is not None else None
            if remaining is not None and remaining <= 0:
                logger.warning(f"Timed out with {len(self.__futures)} futures in queue")
                break

            # Pop the future from the queue.  If it succeeds great but if not it will be discarded
            # on the next loop iteration without commit.  An error will be logged.
            message, future = self.__futures.popleft()

            try:
                future.result(remaining)
                self.__commit({message.partition: Position(message.offset, message.timestamp)})
            except Exception:
                logger.exception(
                    "Async future failed in replays recording-segment consumer.",
                    extra={"offset": message.offset},
                )

    def poll(self) -> None:
        while self.__futures:
            message, future = self.__futures[0]
            if not future.done():
                break

            if future.exception():
                logger.error(
                    "Async future failed in replays recording-segment consumer.",
                    exc_info=future.exception(),
                    extra={"offset": message.offset},
                )

            self.__futures.popleft()
            self.__commit_data[message.partition] = Position(message.next_offset, message.timestamp)

        self.__throttled_commit()

    def __throttled_commit(self, force: bool = False) -> None:
        now = time.time()

        if (now - self.__last_committed) >= COMMIT_FREQUENCY_SEC or force is True:
            if self.__commit_data:
                self.__commit(self.__commit_data)
                self.__last_committed = now
                self.__commit_data = {}
