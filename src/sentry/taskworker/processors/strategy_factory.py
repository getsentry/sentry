from sentry.runner import configure

configure()
import logging
from collections.abc import Mapping, MutableSequence, Sequence
from datetime import datetime
from typing import Any

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

from sentry.taskworker.models import PendingTasks
from sentry.utils import json

logging.basicConfig(
    level=getattr(logging, "INFO"),
    format="%(asctime)s %(message)s",
    force=True,
)
logger = logging.getLogger(__name__)


def process_message(message: Message[KafkaPayload]):
    loaded_message = json.loads(message.payload.value)
    logger.info("processing message: %r...", loaded_message)
    return loaded_message


class StrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(self, topic) -> None:
        self.pool = MultiprocessingPool(num_processes=3)
        self.topic = topic

    def create_pending_tasks_batch(
        self, message: Message[MutableSequence[Mapping[str, Any]]]
    ) -> Sequence[PendingTasks]:
        msg = message.payload
        pending_tasks_batch = [
            PendingTasks(
                topic=self.topic,
                task_name=m["taskname"],
                parameters=m["parameters"],
                task_namespace=m.get("task_namespace"),
                # TODO: idk how to get the partition
                partition=1,
                # TODO: idk how to get offset
                offset=1,
                state="PENDING",
                # TODO: i think the sample message's type is not matching the db, hardcoding rn
                # received_at=m["received_at"],
                received_at=datetime(2023, 8, 19, 12, 30, 0),
                retry_state=m["retry_state"],
                # not sure what this field should be, arbitrary value for now
                deadletter_at=datetime(2023, 8, 19, 12, 30, 0),
                processing_deadline=m["deadline"],
            )
            for m in msg
        ]
        return pending_tasks_batch

    def create_with_partitions(
        self, commit: Commit, partitions: Mapping[Partition, int]
    ) -> ProcessingStrategy[KafkaPayload]:
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
            max_batch_size=2,
            max_batch_time=2,
            accumulator=accumulator,
            initial_value=lambda: [],
            next_step=RunTaskInThreads(
                processing_function=flush_batch,
                concurrency=2,
                max_pending_futures=2,
                next_step=CommitOffsets(commit),
            ),
        )
        return RunTaskWithMultiprocessing(
            function=process_message,
            next_step=collect,
            max_batch_size=2,
            max_batch_time=2,
            pool=self.pool,
        )

    def shutdown(self):
        self.pool.close()
