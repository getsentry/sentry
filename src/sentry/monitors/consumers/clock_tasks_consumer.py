from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Mapping
from concurrent.futures import wait
from datetime import datetime, timezone
from functools import partial
from typing import Literal, TypeGuard

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.batching import BatchStep, ValuesBatch
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import BrokerValue, Commit, FilteredPayload, Message, Partition
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.monitors_clock_tasks_v1 import (
    MarkMissing,
    MarkTimeout,
    MarkUnknown,
    MonitorsClockTasks,
)

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.monitors.clock_tasks.check_missed import mark_environment_missing
from sentry.monitors.clock_tasks.check_timeout import mark_checkin_timeout
from sentry.monitors.clock_tasks.mark_unknown import mark_checkin_unknown
from sentry.utils import metrics
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor
from sentry.utils.tracing import start_span

MONITORS_CLOCK_TASKS_CODEC: Codec[MonitorsClockTasks] = get_topic_codec(Topic.MONITORS_CLOCK_TASKS)

logger = logging.getLogger(__name__)


def is_mark_timeout(wrapper: MonitorsClockTasks) -> TypeGuard[MarkTimeout]:
    return wrapper["type"] == "mark_timeout"


def is_mark_unknown(wrapper: MonitorsClockTasks) -> TypeGuard[MarkUnknown]:
    return wrapper["type"] == "mark_unknown"


def is_mark_missing(wrapper: MonitorsClockTasks) -> TypeGuard[MarkMissing]:
    return wrapper["type"] == "mark_missing"


def dispatch_clock_task(wrapper: MonitorsClockTasks) -> None:
    """Execute a single decoded clock task."""
    try:
        ts = datetime.fromtimestamp(wrapper["ts"], tz=timezone.utc)

        if is_mark_timeout(wrapper):
            mark_checkin_timeout(int(wrapper["checkin_id"]), ts)
            return

        if is_mark_unknown(wrapper):
            mark_checkin_unknown(int(wrapper["checkin_id"]), ts)
            return

        if is_mark_missing(wrapper):
            mark_environment_missing(int(wrapper["monitor_environment_id"]), ts)
            return

        logger.error("Unsupported clock-tick task type: %s", wrapper["type"])
    except Exception:
        logger.exception("Failed to process clock tick task")


def process_clock_task(message: Message[KafkaPayload | FilteredPayload]) -> None:
    assert not isinstance(message.payload, FilteredPayload)
    assert isinstance(message.value, BrokerValue)

    try:
        wrapper = MONITORS_CLOCK_TASKS_CODEC.decode(message.payload.value)
    except Exception:
        logger.exception("Failed to unpack message payload")
        return

    dispatch_clock_task(wrapper)


def process_clock_task_group(tasks: list[MonitorsClockTasks]) -> None:
    """
    Process a group of clock tasks for the same monitor environment completely
    serially.
    """
    for wrapper in tasks:
        dispatch_clock_task(wrapper)


def process_clock_task_batch(
    executor: ContextPropagatingThreadPoolExecutor,
    message: Message[ValuesBatch[KafkaPayload]],
) -> None:
    """
    Receives batches of clock task messages, groups them by monitor
    environment (ensuring order is preserved) and executes each group using a
    ThreadPoolWorker.
    """
    batch = message.payload

    task_mapping: dict[int, list[MonitorsClockTasks]] = defaultdict(list)

    for item in batch:
        assert isinstance(item, BrokerValue)

        try:
            wrapper = MONITORS_CLOCK_TASKS_CODEC.decode(item.payload.value)
        except Exception:
            logger.exception("Failed to unpack message payload")
            continue

        # XXX(epurkhiser): Tasks for the same monitor environment MUST be
        # processed in-order. `monitor_environment_id` is required on every
        # task type and is what the producers key on, so grouping on it keeps
        # that guarantee while unrelated environments run in parallel.
        task_mapping[int(wrapper["monitor_environment_id"])].append(wrapper)

    # Number of clock tasks that are being processed in this batch
    metrics.gauge("monitors.clock_tasks.parallel_batch_count", len(batch))

    # Number of clock task groups we've collected to be processed in parallel
    metrics.gauge("monitors.clock_tasks.parallel_batch_groups", len(task_mapping))

    # Submit task groups for processing. The `wait` is a barrier, offsets must
    # not be committed until every group in the batch has completed.
    with start_span(
        op="process_clock_task_batch",
        name="monitors.clock_tasks_consumer",
        transaction=True,
    ):
        futures = [
            executor.submit(process_clock_task_group, group) for group in task_mapping.values()
        ]
        wait(futures)


class MonitorClockTasksStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    parallel_executor: ContextPropagatingThreadPoolExecutor | None = None

    batched_parallel = False
    """
    Does the consumer process unrelated monitor environments in parallel?
    """

    max_batch_size = 500
    """
    How many messages will be batched at once when in parallel mode.
    """

    max_batch_time = 1
    """
    The maximum time in seconds to accumulate a batch of clock tasks.
    """

    def __init__(
        self,
        mode: Literal["batched-parallel", "serial"] | None = None,
        max_batch_size: int | None = None,
        max_batch_time: int | None = None,
        max_workers: int | None = None,
    ) -> None:
        if mode == "batched-parallel":
            self.batched_parallel = True
            self.parallel_executor = ContextPropagatingThreadPoolExecutor(max_workers=max_workers)

        if max_batch_size is not None:
            self.max_batch_size = max_batch_size
        if max_batch_time is not None:
            self.max_batch_time = max_batch_time

    def shutdown(self) -> None:
        if self.parallel_executor:
            self.parallel_executor.shutdown()

    def create_parallel_worker(self, commit: Commit) -> ProcessingStrategy[KafkaPayload]:
        assert self.parallel_executor is not None
        batch_processor = RunTask(
            function=partial(process_clock_task_batch, self.parallel_executor),
            next_step=CommitOffsets(commit),
        )
        return BatchStep(
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
            next_step=batch_processor,
        )

    def create_synchronous_worker(self, commit: Commit) -> ProcessingStrategy[KafkaPayload]:
        return RunTask(
            function=process_clock_task,
            next_step=CommitOffsets(commit),
        )

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        if self.batched_parallel:
            return self.create_parallel_worker(commit)
        else:
            return self.create_synchronous_worker(commit)
