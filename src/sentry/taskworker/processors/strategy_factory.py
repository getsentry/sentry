from __future__ import annotations

import logging
from collections.abc import Mapping, MutableSequence, Sequence
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import (
    CommitOffsets,
    ProcessingStrategy,
    ProcessingStrategyFactory,
    Reduce,
    RunTaskInThreads,
    RunTaskWithMultiprocessing,
)
from arroyo.processing.strategies.run_task_with_multiprocessing import MultiprocessingPool
from arroyo.types import BaseValue, Commit, Message, Partition
from django.utils import timezone

from sentry.conf.types.kafka_definition import Topic
from sentry.utils import json

if TYPE_CHECKING:
    from sentry.taskworker.models import PendingTasks

logger = logging.getLogger("sentry.taskworker.consumer")


def process_message(message: Message[KafkaPayload]):
    loaded_message = json.loads(message.payload.value)
    logger.info("processing message: %r...", loaded_message)
    return loaded_message


class StrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self,
        max_batch_size: int,
        max_batch_time: int,
        num_processes: int,
        input_block_size: int | None,
        output_block_size: int | None,
    ) -> None:
        super().__init__()
        self.pool = MultiprocessingPool(num_processes)

        # TODO make this a parameter that `get_stream_processor` forwards
        self.topic = Topic.HACKWEEK

        # Maximum amount of time tasks are allowed to live in pending task
        # after this time tasks should be deadlettered if they are followed
        # by completed records. Should come from CLI/options
        self.max_pending_timeout = 8 * 60

    def create_pending_tasks_batch(
        self, message: Message[MutableSequence[Mapping[str, Any]]]
    ) -> Sequence[PendingTasks]:
        from sentry.taskworker.models import PendingTasks

        msg = message.payload

        pending_tasks_batch = [
            PendingTasks(
                topic=self.topic.value,
                task_name=m["taskname"],
                parameters=m["parameters"],
                task_namespace=m.get("task_namespace"),
                # TODO: idk how to get the partition
                partition=1,
                # TODO: idk how to get offset
                offset=1,
                state=PendingTasks.States.PENDING,
                # TODO: i think the sample message's type is not matching the db, hardcoding rn
                # received_at=m["received_at"],
                received_at=datetime.fromtimestamp(m["received_at"], tz=UTC),
                retry_attempts=m["retry_state"]["attempts"] if m["retry_state"] else None,
                retry_kind=m["retry_state"]["kind"] if m["retry_state"] else None,
                discard_after_attempt=m["retry_state"]["discard_after_attempt"]
                if m["retry_state"]
                else None,
                deadletter_after_attempt=m["retry_state"]["deadletter_after_attempt"]
                if m["retry_state"]
                else None,
                deadletter_at=timezone.now() + timedelta(seconds=self.max_pending_timeout),
                processing_deadline=m["deadline"],
            )
            for m in msg
        ]
        return pending_tasks_batch

    def create_with_partitions(
        self, commit: Commit, partitions: Mapping[Partition, int]
    ) -> ProcessingStrategy[KafkaPayload]:
        from sentry.taskworker.models import PendingTasks

        def accumulator(
            batched_results: MutableSequence[Mapping[str, Any]],
            message: BaseValue[Mapping[str, Any]],
        ) -> MutableSequence[Mapping[str, Any]]:
            batched_results.append(message.payload)
            return batched_results

        def flush_batch(
            message: Message[MutableSequence[Mapping[str, Any]]]
        ) -> Message[MutableSequence[Mapping[str, Any]]]:
            logger.info("Flushing batch. Messages: %r...", len(message.payload))
            batch = self.create_pending_tasks_batch(message)
            PendingTasks.objects.bulk_create(batch)
            return message

        collect = Reduce(
            # TODO use CLI options
            max_batch_size=2,
            max_batch_time=2,
            accumulator=accumulator,
            initial_value=lambda: [],
            next_step=RunTaskInThreads(
                processing_function=flush_batch,
                concurrency=2,
                max_pending_futures=2,
                # TODO add retry and other cleanup steps, and then commit offsets
                next_step=CommitOffsets(commit),
            ),
        )

        return RunTaskWithMultiprocessing(
            function=process_message,
            next_step=collect,
            # TODO use CLI options
            max_batch_size=2,
            max_batch_time=2,
            pool=self.pool,
        )

    def shutdown(self):
        self.pool.close()
