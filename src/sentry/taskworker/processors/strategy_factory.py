from __future__ import annotations

import logging
from collections.abc import Mapping, MutableSequence
from time import time

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
from django.conf import settings
from sentry_protos.hackweek_team_no_celery_pls.v1alpha.pending_task_pb2 import PENDING, Task, Work

from sentry.conf.types.kafka_definition import Topic
from sentry.taskworker.pending_task_store import PendingTaskStore

logger = logging.getLogger("sentry.taskworker.consumer")


def process_message(message: Message[KafkaPayload]) -> Task:
    work = Work()
    work.ParseFromString(message.payload.value)
    ((partition, offset),) = message.committable.items()
    return Task(
        work=work,
        status=PENDING,
        topic=partition.topic.name,
        partition=partition.index,
        offset=offset,
        received_at=int(time()),
    )


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
        self.pending_task_store = PendingTaskStore()

        self.do_imports()

    def do_imports(self) -> None:
        for module in settings.TASKWORKER_IMPORTS:
            __import__(module)

    def create_with_partitions(
        self, commit: Commit, _: Mapping[Partition, int]
    ) -> ProcessingStrategy[KafkaPayload]:
        def accumulator(
            batched_results: MutableSequence[Task],
            message: BaseValue[Task],
        ) -> MutableSequence[Task]:
            batched_results.append(message.payload)
            return batched_results

        def flush_batch(
            message: Message[MutableSequence[Task]],
        ) -> Message[MutableSequence[Task]]:
            logger.info("Flushing batch. Messages: %r...", len(message.payload))
            self.pending_task_store.store(message.value.payload)
            return message

        def do_upkeep(
            message: Message[MutableSequence[Task]],
        ) -> Message[MutableSequence[Task]]:
            self.pending_task_store.handle_processing_deadlines()
            self.pending_task_store.handle_retry_state_tasks()
            self.pending_task_store.handle_deadletter_at()
            self.pending_task_store.handle_failed_tasks()

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
            initial_value=list,
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
