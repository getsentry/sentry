import logging
import signal
from collections.abc import Mapping, MutableSequence
from datetime import datetime
from typing import Any

import click
import sentry_sdk
from arroyo.backends.kafka.configuration import build_kafka_consumer_configuration
from arroyo.backends.kafka.consumer import KafkaConsumer, KafkaPayload
from arroyo.commit import ONCE_PER_SECOND
from arroyo.processing.processor import StreamProcessor
from arroyo.processing.strategies import (
    CommitOffsets,
    ProcessingStrategy,
    ProcessingStrategyFactory,
    Reduce,
    RunTaskInThreads,
    RunTaskWithMultiprocessing,
)
from arroyo.processing.strategies.run_task_with_multiprocessing import MultiprocessingPool
from arroyo.types import BaseValue, Commit, Message, Partition, Topic

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
            pending_task = PendingTasks.create(
                topic=self.topic,
                task_name=message["taskname"],
                parameters=message["parameters"],
                task_namespace=message.get("task_namespace"),
                partition=message.partition(),
                offset=message.offset(),
                state="PENDING",
                received_at=message["received_at"],
                retry_state=message["retry_state"],
                # not sure what this field should be, arbitrary value for now
                deadletter_at=datetime(2023, 8, 19, 12, 30, 0),
                processing_deadline=message["deadline"],
            )
            pending_task.save()
            return message

        def commit_offset() -> None:
            # some logic to commit logic, probably check that a task's state is 'done' now
            CommitOffsets(commit)

        collect = Reduce(
            max_batch_size=1,
            max_batch_time=1,
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
            max_batch_size=1,
            max_batch_time=1,
            pool=self.pool,
        )

    def shutdown(self):
        self.pool.close()


@click.command()
@click.option("--kafka-consumer-bootstrap-servers", default="127.0.0.1:9092")
@click.option("--source_topic", default="hackweek")
@click.option("--group_id", default="hackweek-kafkatasks")
@click.option("--auto_offset_reset", default="earliest")
def run(
    kafka_consumer_bootstrap_servers,
    source_topic,
    group_id,
    auto_offset_reset,
):
    logger.info("starting consumer")
    sentry_sdk.init(
        dsn="https://56be405b1fe28a57d5c77b887ac2eacb@o1.ingest.us.sentry.io/4507805868490752",
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
    )

    TOPIC = Topic(source_topic)
    consumer_bootstrap_servers = kafka_consumer_bootstrap_servers.split(",")
    consumer = KafkaConsumer(
        build_kafka_consumer_configuration(
            default_config={},
            bootstrap_servers=consumer_bootstrap_servers,
            auto_offset_reset=auto_offset_reset,
            group_id=group_id,
        )
    )

    factory = StrategyFactory(topic=source_topic)

    processor = StreamProcessor(
        consumer=consumer,
        topic=TOPIC,
        processor_factory=factory,
        commit_policy=ONCE_PER_SECOND,
    )

    def handler(signum: int, frame: Any) -> None:
        logger.info("Shutting down consumer")
        processor.signal_shutdown()

    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)

    processor.run()


if __name__ == "__main__":
    run()
