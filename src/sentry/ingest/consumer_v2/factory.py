from __future__ import annotations

from typing import Any, Callable, Mapping, MutableMapping, NamedTuple, Optional

from arroyo import Topic, configure_metrics
from arroyo.backends.kafka.configuration import build_kafka_consumer_configuration
from arroyo.backends.kafka.consumer import KafkaConsumer, KafkaPayload
from arroyo.commit import ONCE_PER_SECOND
from arroyo.processing.processor import StreamProcessor
from arroyo.processing.strategies import (
    CommitOffsets,
    ProcessingStrategy,
    ProcessingStrategyFactory,
    RunTask,
    RunTaskWithMultiprocessing,
)
from arroyo.types import Commit, Message, Partition
from django.conf import settings

from sentry.ingest.consumer_v2.ingest import process_ingest_message
from sentry.ingest.types import ConsumerType
from sentry.snuba.utils import initialize_consumer_state
from sentry.utils import kafka_config, metrics
from sentry.utils.arroyo import MetricsWrapper


class MultiProcessConfig(NamedTuple):
    num_processes: int
    max_batch_size: int
    max_batch_time: int
    input_block_size: int
    output_block_size: int


class IngestStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self,
        function: Callable[[Message[KafkaPayload]], None],
        multi_process: Optional[MultiProcessConfig] = None,
    ):
        self.function = function
        self.multi_process = multi_process

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        if (mp := self.multi_process) is not None:
            return RunTaskWithMultiprocessing(
                self.function,
                CommitOffsets(commit),
                mp.num_processes,
                mp.max_batch_size,
                mp.max_batch_time,
                mp.input_block_size,
                mp.output_block_size,
                initializer=initialize_consumer_state,
            )
        else:
            return RunTask(
                function=self.function,
                next_step=CommitOffsets(commit),
            )


def get_ingest_consumer(
    type_: str,
    group_id: str,
    auto_offset_reset: str,
    strict_offset_reset: bool,
    max_batch_size: int,
    max_batch_time: int,
    processes: int,
    input_block_size: int,
    output_block_size: int,
    force_topic: str | None,
    force_cluster: str | None,
    **options: Any,
) -> StreamProcessor[KafkaPayload]:
    topic = force_topic or ConsumerType.get_topic_name(type_)

    metrics_name = f"ingest_{type_}"
    configure_metrics(MetricsWrapper(metrics.backend, name=metrics_name))

    consumer_config = get_config(
        topic,
        group_id,
        auto_offset_reset=auto_offset_reset,
        strict_offset_reset=strict_offset_reset,
        force_cluster=force_cluster,
    )
    consumer = KafkaConsumer(consumer_config)

    # The `attachments` topic that is used for "complex" events needs ordering
    # guarantees: Attachments have to be written before the event using them
    # is being processed. We will use a simple serial `RunTask` for those
    # for now.
    # For all other topics, we can use multi processing.
    allow_multi_processing = topic != settings.KAFKA_INGEST_ATTACHMENTS
    multi_process = None
    if processes > 1 and allow_multi_processing:
        multi_process = MultiProcessConfig(
            num_processes=processes,
            max_batch_size=max_batch_size,
            max_batch_time=max_batch_time,
            input_block_size=input_block_size,
            output_block_size=output_block_size,
        )

    processor_factory = IngestStrategyFactory(process_ingest_message, multi_process=multi_process)

    return StreamProcessor(
        consumer=consumer,
        topic=Topic(topic),
        processor_factory=processor_factory,
        commit_policy=ONCE_PER_SECOND,
    )


def get_config(
    topic: str,
    group_id: str,
    auto_offset_reset: str,
    strict_offset_reset: bool,
    force_cluster: str | None,
) -> MutableMapping[str, Any]:
    cluster_name: str = force_cluster or settings.KAFKA_TOPICS[topic]["cluster"]
    return build_kafka_consumer_configuration(
        kafka_config.get_kafka_consumer_cluster_options(
            cluster_name,
        ),
        group_id=group_id,
        auto_offset_reset=auto_offset_reset,
        strict_offset_reset=strict_offset_reset,
    )
