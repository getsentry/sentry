import logging

from sentry_kafka_schemas import get_codec
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
from sentry.utils.kafka_config import get_topic_definition
from sentry.utils.tracing import start_span

logger = logging.getLogger(__name__)


def _process_subscription_message(message_bytes: bytes, dataset: Dataset) -> None:
    """Process a subscription message from raw Kafka message bytes."""
    from sentry.snuba.query_subscriptions.consumer import handle_message
    from sentry.utils import metrics

    logical_topic = dataset_to_logical_topic[dataset]
    topic = get_topic_definition(Topic(logical_topic))["real_topic_name"]

    with (
        start_span(
            op="handle_message",
            name="query_subscription_consumer_process_message",
            custom_sampling_context={"sample_rate": options.get("subscriptions-query.sample-rate")},
            transaction=True,
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
                "Unexpected error while handling subscription task message. Skipping message.",
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
            """Process a subscription message from raw Kafka message bytes.

            This task is directly spawned from taskbroker in "raw mode". You won't find
            any application code that calls apply_async or delay directly on it,
            instead taskbroker itself is configured to consume a topic (in infra
            templates) and spawns tasks for each message.

            As such, the task signature, name and namespace cannot be changed without
            coordination.
            """
            _process_subscription_message(message_bytes, _d)


_register_subscription_tasks()
