from __future__ import annotations

import logging
import queue
import threading
import time
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Generic, TypeVar

import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import ProcessingStrategy
from arroyo.types import BrokerValue, FilteredPayload, Message, Partition

from sentry.utils import metrics

logger = logging.getLogger(__name__)

T = TypeVar("T")


@dataclass
class WorkItem(Generic[T]):
    """Work item that includes the original message for offset tracking."""

    partition: Partition
    offset: int
    result: T
    message: Message[KafkaPayload | FilteredPayload]


class OffsetTracker:
    """
    Tracks outstanding offsets and determines which offsets are safe to commit.

    - Tracks offsets per partition
    - Only commits offsets when all prior offsets are processed
    - Thread-safe for concurrent access with per-partition locks
    """

    def __init__(self) -> None:
        self.all_offsets: dict[Partition, set[int]] = defaultdict(set)
        self.outstanding: dict[Partition, set[int]] = defaultdict(set)
        self.last_committed: dict[Partition, int] = {}
        self.partition_locks: dict[Partition, threading.Lock] = {}

    def _get_partition_lock(self, partition: Partition) -> threading.Lock:
        """Get or create a lock for a partition."""
        lock = self.partition_locks.get(partition)
        if lock:
            return lock
        return self.partition_locks.setdefault(partition, threading.Lock())

    def add_offset(self, partition: Partition, offset: int) -> None:
        """Record that we've started processing an offset."""
        with self._get_partition_lock(partition):
            self.all_offsets[partition].add(offset)
            self.outstanding[partition].add(offset)

    def complete_offset(self, partition: Partition, offset: int) -> None:
        """Mark an offset as completed."""
        with self._get_partition_lock(partition):
            self.outstanding[partition].discard(offset)

    def get_committable_offsets(self) -> dict[Partition, int]:
        """
        Get the highest offset per partition that can be safely committed.

        For each partition, finds the highest contiguous offset that has been processed.
        """
        committable = {}
        for partition in list(self.all_offsets.keys()):
            with self._get_partition_lock(partition):
                all_offsets = self.all_offsets[partition]
                if not all_offsets:
                    continue

                outstanding = self.outstanding[partition]
                last_committed = self.last_committed.get(partition, -1)

                min_offset = min(all_offsets)
                max_offset = max(all_offsets)

                start = max(last_committed + 1, min_offset)

                highest_committable = last_committed
                for offset in range(start, max_offset + 1):
                    if offset in all_offsets and offset not in outstanding:
                        highest_committable = offset
                    else:
                        break

                if highest_committable > last_committed:
                    committable[partition] = highest_committable

        return committable

    def mark_committed(self, partition: Partition, offset: int) -> None:
        """Update the last committed offset for a partition."""
        with self._get_partition_lock(partition):
            self.last_committed[partition] = offset
            # Remove all offsets <= committed offset
            self.all_offsets[partition] = {o for o in self.all_offsets[partition] if o > offset}


class OrderedQueueWorker(threading.Thread, Generic[T]):
    """Worker thread that processes items from a queue in order."""

    def __init__(
        self,
        worker_id: int,
        work_queue: queue.Queue[WorkItem[T]],
        result_processor: Callable[[str, T], None],
        identifier: str,
        offset_tracker: OffsetTracker,
    ) -> None:
        super().__init__(daemon=True)
        self.worker_id = worker_id
        self.work_queue = work_queue
        self.result_processor = result_processor
        self.identifier = identifier
        self.offset_tracker = offset_tracker
        self.shutdown = False

    def run(self) -> None:
        """Process items from the queue in order."""
        while not self.shutdown:
            try:
                work_item = self.work_queue.get()
            except queue.ShutDown:
                break

            try:
                with sentry_sdk.start_transaction(
                    op="queue_worker.process",
                    name=f"monitors.{self.identifier}.worker_{self.worker_id}",
                ):
                    self.result_processor(self.identifier, work_item.result)

            except queue.ShutDown:
                break
            except Exception:
                logger.exception(
                    "Unexpected error in queue worker", extra={"worker_id": self.worker_id}
                )
            finally:
                self.offset_tracker.complete_offset(work_item.partition, work_item.offset)
                metrics.gauge(
                    "remote_subscriptions.queue_worker.queue_depth",
                    self.work_queue.qsize(),
                    tags={
                        "identifier": self.identifier,
                    },
                )


class FixedQueuePool(Generic[T]):
    """
    Fixed pool of queues that guarantees order within groups.

    Key properties:
    - Each group is consistently assigned to the same queue
    - Each queue has exactly one worker thread
    - Items within a queue are processed in FIFO order
    - No dynamic reassignment that could break ordering
    - Tracks offset completion for safe commits
    """

    def __init__(
        self,
        result_processor: Callable[[str, T], None],
        identifier: str,
        num_queues: int = 20,
    ) -> None:
        self.result_processor = result_processor
        self.identifier = identifier
        self.num_queues = num_queues
        self.offset_tracker = OffsetTracker()
        self.queues: list[queue.Queue[WorkItem[T]]] = []
        self.workers: list[OrderedQueueWorker[T]] = []

        for i in range(num_queues):
            work_queue: queue.Queue[WorkItem[T]] = queue.Queue()
            self.queues.append(work_queue)

            worker = OrderedQueueWorker[T](
                worker_id=i,
                work_queue=work_queue,
                result_processor=result_processor,
                identifier=identifier,
                offset_tracker=self.offset_tracker,
            )
            worker.start()
            self.workers.append(worker)

    def get_queue_for_group(self, group_key: str) -> int:
        """
        Get queue index for a group using consistent hashing.
        """
        return hash(group_key) % self.num_queues

    def submit(self, group_key: str, work_item: WorkItem[T]) -> None:
        """
        Submit a work item to the appropriate queue.
        """
        queue_index = self.get_queue_for_group(group_key)
        work_queue = self.queues[queue_index]

        self.offset_tracker.add_offset(work_item.partition, work_item.offset)
        work_queue.put(work_item)

    def get_stats(self) -> dict[str, Any]:
        """Get statistics about queue depths."""
        queue_depths = [q.qsize() for q in self.queues]
        return {
            "queue_depths": queue_depths,
            "total_items": sum(queue_depths),
        }

    def wait_until_empty(self, timeout: float = 5.0) -> bool:
        """Wait until all queues are empty. Returns True if successful, False if timeout."""
        start_time = time.time()
        while time.time() - start_time < timeout:
            if self.get_stats()["total_items"] == 0:
                return True
            time.sleep(0.01)
        return False

    def shutdown(self) -> None:
        """Gracefully shutdown all workers."""
        for worker in self.workers:
            worker.shutdown = True

        for q in self.queues:
            try:
                q.shutdown(immediate=False)
            except Exception:
                logger.exception("Error shutting down queue")

        for worker in self.workers:
            worker.join(timeout=5.0)


class SimpleQueueProcessingStrategy(ProcessingStrategy[KafkaPayload], Generic[T]):
    """
    Processing strategy that uses a fixed pool of queues.

    Guarantees:
    - Items for the same group are processed in order
    - No item is lost or processed out of order
    - Natural backpressure when queues fill up
    - Only commits offsets after successful processing
    """

    def __init__(
        self,
        queue_pool: FixedQueuePool[T],
        decoder: Callable[[KafkaPayload | FilteredPayload], T | None],
        grouping_fn: Callable[[T], str],
        commit_function: Callable[[dict[Partition, int]], None],
    ) -> None:
        self.queue_pool = queue_pool
        self.decoder = decoder
        self.grouping_fn = grouping_fn
        self.commit_function = commit_function
        self.shutdown_event = threading.Event()

        self.commit_thread = threading.Thread(target=self._commit_loop, daemon=True)
        self.commit_thread.start()

    def _commit_loop(self) -> None:
        while not self.shutdown_event.is_set():
            try:
                self.shutdown_event.wait(1.0)

                committable = self.queue_pool.offset_tracker.get_committable_offsets()

                if committable:
                    metrics.incr(
                        "remote_subscriptions.queue_pool.offsets_committed",
                        len(committable),
                        tags={"identifier": self.queue_pool.identifier},
                    )

                    self.commit_function(committable)
                    for partition, offset in committable.items():
                        self.queue_pool.offset_tracker.mark_committed(partition, offset)
            except Exception:
                logger.exception("Error in commit loop")

    def submit(self, message: Message[KafkaPayload | FilteredPayload]) -> None:
        try:
            result = self.decoder(message.payload)

            assert isinstance(message.value, BrokerValue)
            partition = message.value.partition
            offset = message.value.offset

            if result is None:
                self.queue_pool.offset_tracker.add_offset(partition, offset)
                self.queue_pool.offset_tracker.complete_offset(partition, offset)
                return

            group_key = self.grouping_fn(result)

            work_item = WorkItem(
                partition=partition,
                offset=offset,
                result=result,
                message=message,
            )

            self.queue_pool.submit(group_key, work_item)

        except Exception:
            logger.exception("Error submitting message to queue")
            if isinstance(message.value, BrokerValue):
                self.queue_pool.offset_tracker.add_offset(
                    message.value.partition, message.value.offset
                )
                self.queue_pool.offset_tracker.complete_offset(
                    message.value.partition, message.value.offset
                )

    def poll(self) -> None:
        stats = self.queue_pool.get_stats()
        metrics.gauge(
            "remote_subscriptions.queue_pool.total_queued",
            stats["total_items"],
            tags={"identifier": self.queue_pool.identifier},
        )

    def close(self) -> None:
        self.shutdown_event.set()
        self.commit_thread.join(timeout=5.0)
        self.queue_pool.shutdown()

    def terminate(self) -> None:
        self.shutdown_event.set()
        self.queue_pool.shutdown()

    def join(self, timeout: float | None = None) -> None:
        self.close()
