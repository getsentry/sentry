import logging
from collections.abc import Mapping
from functools import partial

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import (
    CommitOffsets,
    ProcessingStrategy,
    ProcessingStrategyFactory,
    RunTask,
)
from arroyo.types import BrokerValue, Commit, Message, Partition
from sentry_kafka_schemas import get_codec
from sentry_sdk import start_transaction
from taskbroker_client.registry import TaskNamespace

from sentry import options
from sentry.conf.types.kafka_definition import Topic
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.query_subscriptions.constants import dataset_to_logical_topic
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import (
    snuba_eap_subscriptions_raw_tasks,
    snuba_events_subscriptions_raw_tasks,
    snuba_generic_metrics_subscriptions_raw_tasks,
    snuba_metrics_subscriptions_raw_tasks,
    snuba_transactions_subscriptions_raw_tasks,
)
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
        topic_override: str | None = None,
    ):
        self.dataset = Dataset(dataset)
        self.logical_topic = dataset_to_logical_topic[self.dataset]
        if topic_override:
            self.logical_topic = topic_override

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
        start_transaction(
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


def _process_subscription_message(message_bytes: bytes, dataset: Dataset) -> None:
    """Process a subscription message from raw Kafka message bytes."""
    from sentry.snuba.query_subscriptions.consumer import handle_message
    from sentry.utils import metrics

    logical_topic = dataset_to_logical_topic[dataset]
    topic = get_topic_definition(Topic(logical_topic))["real_topic_name"]

    with (
        start_transaction(
            op="handle_message",
            name="query_subscription_consumer_process_message",
            custom_sampling_context={"sample_rate": options.get("subscriptions-query.sample-rate")},
        ),
        metrics.timer("snuba_query_subscriber.handle_message", tags={"dataset": dataset.value}),
    ):
        try:
            handle_message(
                message_bytes,
                -1,  # offset not available in raw mode
                -1,  # partition not available in raw mode
                topic,
                dataset.value,
                get_codec(logical_topic),
            )
        except Exception:
            logger.exception(
                "Unexpected error while handling message in QuerySubscriptionStrategy. Skipping message.",
                extra={"value": message_bytes},
            )


def _register_subscription_tasks() -> None:
    tasks: dict[str, tuple[Dataset, TaskNamespace]] = {
        "events": (Dataset.Events, snuba_events_subscriptions_raw_tasks),
        "transactions": (Dataset.Transactions, snuba_transactions_subscriptions_raw_tasks),
        "metrics": (Dataset.Metrics, snuba_metrics_subscriptions_raw_tasks),
        "generic_metrics": (
            Dataset.PerformanceMetrics,
            snuba_generic_metrics_subscriptions_raw_tasks,
        ),
        "eap": (Dataset.EventsAnalyticsPlatform, snuba_eap_subscriptions_raw_tasks),
    }

    registered_datasets = {dataset for dataset, _ in tasks.values()}
    expected_datasets = set(dataset_to_logical_topic.keys())
    assert registered_datasets == expected_datasets, (
        f"Missing tasks for datasets: {expected_datasets - registered_datasets}"
    )

    for name, (dataset, namespace) in tasks.items():

        @instrumented_task(
            name=f"sentry.snuba.query_subscriptions.run.process_{name}_subscription_from_kafka",
            namespace=namespace,
            processing_deadline_duration=60,
            silo_mode=SiloMode.CELL,
        )
        def task_fn(message_bytes: bytes, _d: Dataset = dataset) -> None:
            _process_subscription_message(message_bytes, _d)


_register_subscription_tasks()
