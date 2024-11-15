import logging
from collections.abc import Mapping
from functools import partial

import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import (
    CommitOffsets,
    ProcessingStrategy,
    ProcessingStrategyFactory,
    RunTask,
)
from arroyo.types import BrokerValue, Commit, Message, Partition
from sentry_kafka_schemas import get_codec

from sentry import options
from sentry.conf.types.kafka_definition import Topic
from sentry.snuba.dataset import Dataset
from sentry.snuba.query_subscriptions.constants import dataset_to_logical_topic
from sentry.utils.arroyo import MultiprocessingPool, run_task_with_multiprocessing
from sentry.utils.kafka_config import get_topic_definition

logger = logging.getLogger(__name__)


class QuerySubscriptionStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self,
        dataset: str,
        max_batch_size: int,
        max_batch_time: int,
        num_processes: int,
        input_block_size: int | None,
        output_block_size: int | None,
        multi_proc: bool = True,
    ):
        self.dataset = Dataset(dataset)
        self.logical_topic = dataset_to_logical_topic[self.dataset]
        self.topic = get_topic_definition(Topic(self.logical_topic))["real_topic_name"]
        self.max_batch_size = max_batch_size
        self.max_batch_time = max_batch_time
        self.input_block_size = input_block_size
        self.output_block_size = output_block_size
        self.multi_proc = multi_proc
        self.pool = MultiprocessingPool(num_processes)

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        callable = partial(process_message, self.dataset, self.topic, self.logical_topic)
        if self.multi_proc:
            return run_task_with_multiprocessing(
                function=callable,
                next_step=CommitOffsets(commit),
                max_batch_size=self.max_batch_size,
                max_batch_time=self.max_batch_time,
                pool=self.pool,
                input_block_size=self.input_block_size,
                output_block_size=self.output_block_size,
            )
        else:
            return RunTask(callable, CommitOffsets(commit))

    def shutdown(self) -> None:
        self.pool.close()


def process_message(
    dataset: Dataset, topic: str, logical_topic: str, message: Message[KafkaPayload]
) -> None:
    from sentry.snuba.query_subscriptions.consumer import handle_message
    from sentry.utils import metrics

    with (
        sentry_sdk.start_transaction(
            op="handle_message",
            name="query_subscription_consumer_process_message",
            custom_sampling_context={"sample_rate": options.get("subscriptions-query.sample-rate")},
        ),
        metrics.timer("snuba_query_subscriber.handle_message", tags={"dataset": dataset.value}),
    ):
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
