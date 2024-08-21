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
    RunTask,
    RunTaskInThreads,
    RunTaskWithMultiprocessing,
)
from arroyo.processing.strategies.run_task_with_multiprocessing import MultiprocessingPool
from arroyo.types import BaseValue, Commit, Message, Partition
from django.db.models import Max
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

    def transform_msg_batch(
        self, message: Message[MutableSequence[Mapping[str, Any]]]
    ) -> MutableSequence[Mapping[str, Any]]:
        transformed_msg_batch: MutableSequence = []
        for msg in message.payload:
            # TODO: need to figure out if this way of getting the offset is
            # actually referring to the message's offset,
            # OR the highest offset per partition included in this batch
            for partition, offset in message.committable.items():
                msg["partition"] = partition.index
                # Lyn said the message itself's offset is always the committable - 1
                msg["offset"] = offset - 1
            transformed_msg_batch.append(msg)
        return transformed_msg_batch

    def create_pending_tasks_batch(
        self, message: Message[MutableSequence[Mapping[str, Any]]]
    ) -> Sequence[PendingTasks]:
        from sentry.taskworker.models import PendingTasks

        transformed_msg_batch = self.transform_msg_batch(message)
        # TODO we'll need a way to de-dupe messages from kafka into pending tasks
        # we don't want to duplicate records during rebalance.
        pending_tasks_batch = [
            PendingTasks(
                topic=self.topic.value,
                task_name=m["taskname"],
                parameters=m["parameters"],
                task_namespace=m.get("task_namespace"),
                partition=m["partition"],
                offset=m["offset"],
                state=PendingTasks.States.PENDING,
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
            for m in transformed_msg_batch
        ]
        return pending_tasks_batch

    def handle_retry_state_tasks(self) -> None:
        from sentry.taskworker.config import taskregistry
        from sentry.taskworker.models import PendingTasks

        retry_qs = PendingTasks.objects.filter(state=PendingTasks.States.RETRY)
        for item in retry_qs:
            task_ns = taskregistry.get(item.task_namespace)
            task_ns.retry_task(item)
        # With retries scheduled, the tasks are complete now.
        retry_qs.update(state=PendingTasks.States.COMPLETE)

    def handle_deadletter_at(self) -> None:
        from sentry.taskworker.models import PendingTasks

        max_completed_id = (
            PendingTasks.objects.filter(state=PendingTasks.States.COMPLETE).aggregate(
                max_offset=Max("offset")
            )["max_offset"]
            or 0
        )

        expired_qs = PendingTasks.objects.filter(
            deadletter_at__lt=timezone.now(),
            offset__lt=max_completed_id,
        ).exclude(state=PendingTasks.States.COMPLETE)
        # Messages that exceeded their deadletter_at are failures
        expired_qs.update(state=PendingTasks.States.FAILURE)

    def handle_processing_deadlines(self) -> None:
        from sentry.taskworker.models import PendingTasks

        past_deadline = PendingTasks.objects.filter(
            processing_deadline__lt=timezone.now(),
        ).exclude(state=PendingTasks.States.COMPLETE)
        to_update = []
        for item in past_deadline:
            if item.has_retries_remaining():
                to_update.append(item.id)

        # Move processing deadline tasks back to pending
        PendingTasks.objects.filter(id__in=to_update).update(state=PendingTasks.States.PENDING)

    def handle_failed_tasks(self) -> None:
        from sentry.taskworker.models import PendingTasks

        failed = PendingTasks.objects.filter(state=PendingTasks.States.FAILURE)
        to_discard = []
        to_deadletter = []
        for item in failed:
            if item.discard_after_attempt is not None:
                to_discard.append(item.id)
            if item.deadletter_after_attempt is not None:
                to_deadletter.append(item.id)

        # Discard messages are simply acked and never processed again
        PendingTasks.objects.filter(id__in=to_discard).update(state=PendingTasks.States.COMPLETE)
        logging.info("task.discarded", extra={"count": len(to_discard)})

        # TODO do deadletter delivery
        PendingTasks.objects.filter(id__in=to_deadletter).update(state=PendingTasks.States.COMPLETE)
        logging.info("task.deadletter", extra={"count": len(to_discard)})

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

        def do_upkeep(
            message: Message[MutableSequence[Mapping[str, Any]]]
        ) -> Message[MutableSequence[Mapping[str, Any]]]:
            self.handle_processing_deadlines()
            self.handle_retry_state_tasks()
            self.handle_deadletter_at()
            self.handle_failed_tasks()

            return message

        upkeep_step = RunTask(
            function=do_upkeep,
            # TODO ideally we commit offsets for completed work
            next_step=CommitOffsets(commit),
        )

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
                next_step=upkeep_step,
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
