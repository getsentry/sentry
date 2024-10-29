from __future__ import annotations

import logging
import time
from collections.abc import Mapping, MutableSequence
from datetime import timedelta

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import (
    CommitOffsets,
    ProcessingStrategy,
    ProcessingStrategyFactory,
    Reduce,
    RunTask,
)
from arroyo.processing.strategies.abstract import MessageRejected
from arroyo.processing.strategies.run_task_with_multiprocessing import MultiprocessingPool
from arroyo.types import BaseValue, Commit, Message, Partition
from django.utils import timezone
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.sentry.v1alpha.taskworker_pb2 import (
    TASK_ACTIVATION_STATUS_PENDING,
    InflightActivation,
    TaskActivation,
)

from sentry.conf.types.kafka_definition import Topic
from sentry.taskworker.pending_task_store import get_storage_backend

logger = logging.getLogger("sentry.taskworker.consumer")


def process_message(message: Message[KafkaPayload]) -> InflightActivation:
    activation = TaskActivation()
    activation.ParseFromString(message.payload.value)
    ((_partition, offset),) = message.committable.items()

    # TODO this should read from task namespace configuration
    deadletter_at = timezone.now() + timedelta(minutes=10)

    return InflightActivation(
        activation=activation,
        status=TASK_ACTIVATION_STATUS_PENDING,
        offset=offset,
        added_at=Timestamp(seconds=int(time.time())),
        deadletter_at=Timestamp(seconds=int(deadletter_at.timestamp())),
        processing_deadline=None,
    )


class TaskWorkerStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self,
        max_batch_size: int,
        max_batch_time: int,
        num_processes: int,
        input_block_size: int | None,
        output_block_size: int | None,
        storage: str | None,
    ) -> None:
        super().__init__()
        self.pool = MultiprocessingPool(num_processes)

        # TODO make this a parameter that `get_stream_processor` forwards
        self.topic = Topic.HACKWEEK

        # Maximum amount of time tasks are allowed to live in pending task
        # after this time tasks should be deadlettered if they are followed
        # by completed records. Should come from CLI/options
        self.max_pending_timeout = 8 * 60

        # Maximum number of pending inflight activations in the store before backpressure is emitted
        self.max_inflight_activation_in_store = 1000  # make this configurable

        self.pending_task_store = get_storage_backend(storage)

    def create_with_partitions(
        self, commit: Commit, _: Mapping[Partition, int]
    ) -> ProcessingStrategy[KafkaPayload]:
        def accumulator(
            batched_results: MutableSequence[InflightActivation],
            message: BaseValue[InflightActivation],
        ) -> MutableSequence[InflightActivation]:
            batched_results.append(message.payload)
            return batched_results

        def flush_batch(
            message: Message[MutableSequence[InflightActivation]],
        ) -> Message[MutableSequence[InflightActivation]]:
            logger.info("Flushing batch. Messages: %r...", len(message.payload))
            self.pending_task_store.store(message.value.payload)
            return message

        def do_upkeep(
            message: Message[KafkaPayload],
        ) -> KafkaPayload:
            self.pending_task_store.handle_processing_deadlines()
            self.pending_task_store.handle_retry_state_tasks()
            self.pending_task_store.handle_deadletter_at()
            self.pending_task_store.handle_failed_tasks()
            self.pending_task_store.remove_completed()

            return message.payload

        def limit_tasks(
            message: Message[KafkaPayload],
        ) -> KafkaPayload:
            count = self.pending_task_store.count_pending_task()
            if count >= self.max_inflight_activation_in_store:
                # The number of pending inflight activations in the store exceeds the limit.
                # Wait for workers to complete tasks before adding the next offset to the queue.
                logger.info(
                    "Number of inflight activation: %s exceeds the limit: %s. Retrying in 3 seconds",
                    count,
                    self.max_inflight_activation_in_store,
                )
                raise MessageRejected()
            return message.payload

        flush = RunTask(
            function=flush_batch,
            next_step=CommitOffsets(commit),
        )

        collect = Reduce(
            # TODO use CLI options
            max_batch_size=2,
            max_batch_time=2,
            accumulator=accumulator,
            initial_value=list,
            next_step=flush,
        )

        process = RunTask(
            function=process_message,
            next_step=collect,
        )

        limit = RunTask(
            function=limit_tasks,
            next_step=process,
        )

        return RunTask(
            function=do_upkeep,
            # TODO ideally we commit offsets for completed work
            next_step=limit,
        )

    def shutdown(self):
        self.pool.close()
