from __future__ import annotations

import logging
import time
from collections.abc import Mapping, MutableSequence

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import (
    CommitOffsets,
    ProcessingStrategy,
    ProcessingStrategyFactory,
    Reduce,
    RunTask,
)
from arroyo.processing.strategies.abstract import MessageRejected
from arroyo.types import BaseValue, Commit, Message, Partition
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.sentry.v1alpha.taskworker_pb2 import (
    TASK_ACTIVATION_STATUS_PENDING,
    InflightActivation,
    TaskActivation,
)

from sentry.taskworker.inflight_activation_store import InflightTaskStoreSqlite

logger = logging.getLogger("sentry.taskworker.consumer")


class TaskWorkerStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self,
        max_batch_size: int,
        max_batch_time: int,
        num_processes: int,
        max_pending_timeout: int,
        max_inflight_activation_in_store: int,
        input_block_size: int | None,
        output_block_size: int | None,
    ) -> None:
        super().__init__()
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.input_block_size = input_block_size
        self.output_block_size = output_block_size

        # Maximum amount of seconds that tasks are allowed to live in the inflight activation store.
        # After this time elapses, tasks are be deadlettered if they are followed by completed records.
        self.max_pending_timeout = max_pending_timeout

        # Maximum number of pending inflight activations in the store before backpressure is emitted
        self.max_inflight_activation_in_store = max_inflight_activation_in_store

        self.inflight_task_store = InflightTaskStoreSqlite()

    def create_with_partitions(
        self, commit: Commit, _: Mapping[Partition, int]
    ) -> ProcessingStrategy[KafkaPayload]:
        def process_message(message: Message[KafkaPayload]) -> InflightActivation:
            activation = TaskActivation()
            activation.ParseFromString(message.payload.value)
            ((_partition, offset),) = message.committable.items()
            deadletter_at = int(time.time()) + self.max_pending_timeout

            return InflightActivation(
                activation=activation,
                status=TASK_ACTIVATION_STATUS_PENDING,
                offset=offset,
                added_at=Timestamp(seconds=int(time.time())),
                deadletter_at=Timestamp(seconds=deadletter_at),
                processing_deadline=None,
            )

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
            self.inflight_task_store.store(message.value.payload)
            return message

        def do_upkeep(
            message: Message[KafkaPayload],
        ) -> KafkaPayload:
            self.inflight_task_store.handle_processing_deadlines()
            self.inflight_task_store.handle_retry_state_tasks()
            self.inflight_task_store.handle_deadletter_at()
            self.inflight_task_store.handle_failed_tasks()
            self.inflight_task_store.remove_completed()

            return message.payload

        def limit_tasks(
            message: Message[KafkaPayload],
        ) -> KafkaPayload:
            count = self.inflight_task_store.count_pending_task()
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
            max_batch_size=self.max_batch_size,
            max_batch_time=self.max_batch_time,
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
