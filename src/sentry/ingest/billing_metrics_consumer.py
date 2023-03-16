import logging
from datetime import datetime, timezone
from typing import Any, Mapping, Optional, Sequence, TypedDict, Union, cast

from arroyo import Topic
from arroyo.backends.kafka import KafkaConsumer, KafkaPayload
from arroyo.backends.kafka.configuration import build_kafka_consumer_configuration
from arroyo.commit import ONCE_PER_SECOND
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.types import Commit, Message, Partition
from django.conf import settings

from sentry.constants import DataCategory
from sentry.sentry_metrics.indexer.strings import TRANSACTION_METRICS_NAMES
from sentry.utils import json
from sentry.utils.kafka_config import get_kafka_consumer_cluster_options
from sentry.utils.outcomes import Outcome, track_outcome

logger = logging.getLogger(__name__)


def get_metrics_billing_consumer(
    group_id: str,
    auto_offset_reset: str,
    strict_offset_reset: bool,
    force_topic: Union[str, None],
    force_cluster: Union[str, None],
) -> StreamProcessor[KafkaPayload]:
    topic = force_topic or settings.KAFKA_SNUBA_GENERIC_METRICS
    bootstrap_servers = _get_bootstrap_servers(topic, force_cluster)

    return StreamProcessor(
        consumer=KafkaConsumer(
            build_kafka_consumer_configuration(
                default_config={},
                group_id=group_id,
                strict_offset_reset=strict_offset_reset,
                auto_offset_reset=auto_offset_reset,
                bootstrap_servers=bootstrap_servers,
            ),
        ),
        topic=Topic(topic),
        processor_factory=BillingMetricsConsumerStrategyFactory(),
        commit_policy=ONCE_PER_SECOND,
    )


def _get_bootstrap_servers(topic: str, force_cluster: Union[str, None]) -> Sequence[str]:
    cluster = force_cluster or settings.KAFKA_TOPICS[topic]["cluster"]

    options = get_kafka_consumer_cluster_options(cluster)
    servers = options["bootstrap.servers"]
    if isinstance(servers, (list, tuple)):
        return servers
    return [servers]


class BillingMetricsConsumerStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return BillingTxCountMetricConsumerStrategy(commit)


class MetricsBucket(TypedDict):
    """
    Metrics bucket as decoded from kafka.

    Only defines the fields that are relevant for this consumer."""

    org_id: int
    project_id: int
    metric_id: int
    timestamp: int
    value: Any


class BillingTxCountMetricConsumerStrategy(ProcessingStrategy[KafkaPayload]):
    """A metrics consumer that generates a billing outcome for each processed
    transaction, processing a bucket at a time. The transaction count is
    computed from the amount of values from `d:transactions/duration@millisecond`
    buckets.
    """

    #: The ID of the metric used to count transactions
    metric_id = TRANSACTION_METRICS_NAMES["d:transactions/duration@millisecond"]

    def __init__(
        self,
        commit: Commit,
    ) -> None:
        self.__commit = commit
        self.__closed = False

    def poll(self) -> None:
        pass

    def terminate(self) -> None:
        self.close()

    def close(self) -> None:
        self.__closed = True

    def submit(self, message: Message[KafkaPayload]) -> None:
        assert not self.__closed

        payload = self._get_payload(message)
        self._produce_billing_outcomes(payload)
        self.__commit(message.committable)

    def _get_payload(self, message: Message[KafkaPayload]) -> MetricsBucket:
        payload = json.loads(message.payload.value.decode("utf-8"), use_rapid_json=True)
        return cast(MetricsBucket, payload)

    def _count_processed_transactions(self, bucket_payload: MetricsBucket) -> int:
        if bucket_payload["metric_id"] != self.metric_id:
            return 0
        value = bucket_payload["value"]
        try:
            return len(value)
        except TypeError:
            # Unexpected value type for this metric ID, skip.
            return 0

    def _produce_billing_outcomes(self, payload: MetricsBucket) -> None:
        quantity = self._count_processed_transactions(payload)
        if quantity < 1:
            return

        # track_outcome does not guarantee to deliver the outcome, making this
        # an at-most-once delivery.
        #
        # If it turns out that we drop too many outcomes on shutdown,
        # we may have to revisit this part to achieve a
        # better approximation of exactly-once delivery.
        track_outcome(
            org_id=payload["org_id"],
            project_id=payload["project_id"],
            key_id=None,
            outcome=Outcome.ACCEPTED,
            reason=None,
            timestamp=datetime.now(timezone.utc),
            event_id=None,
            category=DataCategory.TRANSACTION,
            quantity=quantity,
        )

    def join(self, timeout: Optional[float] = None) -> None:
        self.__commit({}, force=True)
