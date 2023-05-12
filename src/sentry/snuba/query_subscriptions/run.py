import logging
from functools import partial
from random import random
from typing import Mapping

import sentry_sdk
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
from arroyo.types import BrokerValue, Commit, Message, Partition
from sentry_kafka_schemas import get_codec

from sentry.snuba.dataset import Dataset
from sentry.snuba.query_subscriptions.constants import dataset_to_logical_topic, topic_to_dataset
from sentry.snuba.utils import initialize_consumer_state

logger = logging.getLogger(__name__)


class QuerySubscriptionStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self,
        topic: str,
        max_batch_size: int,
        max_batch_time: int,
        processes: int,
        input_block_size: int,
        output_block_size: int,
        multi_proc: bool = True,
    ):
        self.topic = topic
        self.dataset = topic_to_dataset[self.topic]
        self.logical_topic = dataset_to_logical_topic[self.dataset]
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.num_processes = processes
        self.input_block_size = input_block_size
        self.output_block_size = output_block_size
        self.multi_proc = multi_proc

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        callable = partial(process_message, self.dataset, self.topic, self.logical_topic)
        if self.multi_proc:
            return RunTaskWithMultiprocessing(
                callable,
                CommitOffsets(commit),
                self.num_processes,
                self.max_batch_size,
                self.max_batch_time,
                self.input_block_size,
                self.output_block_size,
                initializer=initialize_consumer_state,
            )
        else:
            return RunTask(callable, CommitOffsets(commit))


def process_message(
    dataset: Dataset, topic: str, logical_topic: str, message: Message[KafkaPayload]
) -> None:
    from sentry import options
    from sentry.snuba.query_subscriptions.consumer import handle_message
    from sentry.utils import metrics

    with sentry_sdk.start_transaction(
        op="handle_message",
        name="query_subscription_consumer_process_message",
        sampled=random() <= options.get("subscriptions-query.sample-rate"),
    ), metrics.timer("snuba_query_subscriber.handle_message", tags={"dataset": dataset.value}):
        value = message.value
        assert isinstance(value, BrokerValue)
        offset = value.offset
        partition = value.partition.index
        message_value = value.payload.value
        try:
            handle_message(
                message_value,
                offset,
                partition,
                topic,
                dataset.value,
                get_codec(logical_topic),
            )
        except Exception:
            # This is a failsafe to make sure that no individual message will block this
            # consumer. If we see errors occurring here they need to be investigated to
            # make sure that we're not dropping legitimate messages.
            logger.exception(
                "Unexpected error while handling message in QuerySubscriptionStrategy. Skipping message.",
                extra={
                    "offset": offset,
                    "partition": partition,
                    "value": message_value,
                },
            )


def get_query_subscription_consumer(
    topic: str,
    group_id: str,
    strict_offset_reset: bool,
    initial_offset_reset: str,
    max_batch_size: int,
    max_batch_time: int,
    processes: int,
    input_block_size: int,
    output_block_size: int,
    multi_proc: bool = False,
) -> StreamProcessor[KafkaPayload]:
    from django.conf import settings

    from sentry.utils import kafka_config

    cluster_name = settings.KAFKA_TOPICS[topic]["cluster"]
    cluster_options = kafka_config.get_kafka_consumer_cluster_options(cluster_name)

    initialize_metrics()

    consumer = KafkaConsumer(
        build_kafka_consumer_configuration(
            cluster_options,
            group_id=group_id,
            strict_offset_reset=strict_offset_reset,
            auto_offset_reset=initial_offset_reset,
        )
    )
    return StreamProcessor(
        consumer=consumer,
        topic=Topic(topic),
        processor_factory=QuerySubscriptionStrategyFactory(
            topic,
            max_batch_size,
            max_batch_time,
            processes,
            input_block_size,
            output_block_size,
            multi_proc=multi_proc,
        ),
        commit_policy=ONCE_PER_SECOND,
    )


def initialize_metrics() -> None:
    from sentry.utils import metrics
    from sentry.utils.arroyo import MetricsWrapper

    metrics_wrapper = MetricsWrapper(metrics.backend, name="query_subscription_consumer")
    configure_metrics(metrics_wrapper)
