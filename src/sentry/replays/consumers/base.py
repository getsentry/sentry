from __future__ import annotations

import collections
import concurrent.futures as cf
import logging
import multiprocessing as mp
import os
import time
from typing import Callable, Deque, Mapping, MutableMapping, NamedTuple, Optional

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy
from arroyo.types import Message, Partition, Position

from sentry.replays.lib.pool import BoundedProcessPoolExecutor

COMMIT_FREQUENCY_SEC = 1
logger = logging.getLogger("sentry.replays")

mp.set_start_method("fork")


class KafkaMessageFutureTuple(NamedTuple):
    message: Message[KafkaPayload]
    future: cf.Future[None]


class ProcessPoolStrategy(ProcessingStrategy[KafkaPayload]):
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
        max_workers = os.cpu_count() * 1  # self.worker_multiplier
        max_queue_size = max_workers * 1  # self.prefetch_multiplier

        self.__tasks: Deque[KafkaMessageFutureTuple] = collections.deque()
        self.__pool = BoundedProcessPoolExecutor(
            worker_count=max_workers,
            queue_size=max_queue_size,
        )

    def teardown(self):
        # ProcessPoolExecutor must have wait=True. Otherwise the shutdown method will fail. Fixed
        # in Python 3.9.
        #
        # https://bugs.python.org/issue39098
        self.__pool.executor.shutdown(wait=True)

    def submit(self, message: Message[KafkaPayload]) -> None:
        assert not self.__closed
        self.submit_message(message)

    def submit_message(self, message: Message[KafkaPayload]) -> None:
        raise NotImplementedError

    def apply_async(self, func, message) -> None:
        self.__tasks.append((message, self.__pool.submit(func, message)))

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
        while self.__tasks:
            remaining = timeout - (time.time() - start) if timeout is not None else None
            if remaining is not None and remaining <= 0:
                logger.warning(f"Timed out with {len(self.__tasks)} futures in queue")
                break

            # Pop the future from the queue.  If it succeeds great but if not it will be discarded
            # on the next loop iteration without commit.  An error will be logged.
            message, future = self.__tasks.popleft()

            try:
                future.result(remaining)
                self.__commit({message.partition: Position(message.offset, message.timestamp)})
            except Exception:
                logger.exception(
                    "Async future failed in replays recording-segment consumer.",
                    extra={"offset": message.offset},
                )

    def poll(self) -> None:
        while self.__tasks:
            message, future = self.__tasks[0]
            if not future.done():
                break

            if future.exception():
                logger.error(
                    "Async future failed in replays recording-segment consumer.",
                    exc_info=future.exception(),
                    extra={"offset": message.offset},
                )

            self.__tasks.popleft()
            self.__commit_data[message.partition] = Position(message.next_offset, message.timestamp)

        self.__throttled_commit()

    def __throttled_commit(self, force: bool = False) -> None:
        now = time.time()

        if (now - self.__last_committed) >= COMMIT_FREQUENCY_SEC or force is True:
            if self.__commit_data:
                self.__commit(self.__commit_data)
                self.__last_committed = now
                self.__commit_data = {}
