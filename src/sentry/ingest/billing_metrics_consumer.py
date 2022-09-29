from datetime import datetime
from typing import (
    Any,
    Callable,
    Mapping,
    MutableMapping,
    Optional,
    Sequence,
    TypedDict,
    Union,
    cast,
)

from arroyo import Topic
from arroyo.backends.kafka import KafkaConsumer, KafkaPayload
from arroyo.backends.kafka.configuration import build_kafka_consumer_configuration
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.types import Message, Partition, Position
from django.conf import settings

from sentry.constants import DataCategory
from sentry.sentry_metrics.indexer.strings import TRANSACTION_METRICS_NAMES
from sentry.utils import json
from sentry.utils.outcomes import Outcome, track_outcome


def get_metrics_billing_consumer(
    topic: str,
    group_id: str,
    force_topic: Union[str, None],
    force_cluster: Union[str, None],
    **options: Any,
) -> StreamProcessor[KafkaPayload]:
    bootstrap_servers = _get_bootstrap_servers(topic, force_topic, force_cluster)

    return StreamProcessor(
        consumer=KafkaConsumer(
            build_kafka_consumer_configuration(
                default_config={},
                group_id=group_id,
                auto_offset_reset=None,
                bootstrap_servers=bootstrap_servers,
            ),
        ),
        topic=Topic(topic),
        processor_factory=BillingMetricsConsumerStrategyFactory(),
    )


def _get_bootstrap_servers(
    kafka_topic: str, force_topic: Union[str, None], force_cluster: Union[str, None]
) -> Sequence[str]:
    topic = force_topic or kafka_topic
    cluster = force_cluster or settings.KAFKA_TOPICS[topic]["cluster"]

    options = settings.KAFKA_CLUSTERS[cluster]
    servers = options["common"]["bootstrap.servers"]
    if isinstance(servers, (list, tuple)):
        return servers
    return [servers]


class BillingMetricsConsumerStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def create_with_partitions(
        self,
        commit: Callable[[Mapping[Partition, Position]], None],
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
    value: Sequence[float]


class BillingTxCountMetricConsumerStrategy(ProcessingStrategy[KafkaPayload]):
    """A metrics consumer that generates a billing outcome for each processed
    transaction, processing a bucket at a time. The transaction count is
    computed from the amount of values from `d:transactions/duration@millisecond`
    buckets.
    """

    counter_metric_id = TRANSACTION_METRICS_NAMES["d:transactions/duration@millisecond"]

    def __init__(self, commit: Callable[[Mapping[Partition, Position]], None]) -> None:
        self.__commit = commit
        self.__ready_to_commit: MutableMapping[Partition, Position] = {}
        self.__closed = False

    def poll(self) -> None:
        pass

    def terminate(self) -> None:
        self.close()

    def close(self) -> None:
        self.__closed = True

    def submit(self, message: Message[KafkaPayload]) -> None:
        print("Received message")
        assert not self.__closed

        payload = self._get_payload(message)
        self._produce_billing_outcomes(payload)
        self._mark_commit_ready(message)

    def _get_payload(self, message: Message[KafkaPayload]) -> MetricsBucket:
        # TODO: Should we even deserialize on submit?
        payload = json.loads(message.payload.value.decode("utf-8"), use_rapid_json=True)
        return cast(MetricsBucket, payload)

    def _count_processed_transactions(self, bucket_payload: MetricsBucket) -> int:
        if bucket_payload["metric_id"] != self.counter_metric_id:
            return 0
        return len(bucket_payload["value"])

    def _produce_billing_outcomes(self, payload: MetricsBucket) -> None:
        print("Produce billing outcome for ", payload)
        quantity = self._count_processed_transactions(payload)
        print(f"quantity = {quantity}")
        if quantity < 1:
            return

        track_outcome(
            org_id=payload["org_id"],
            project_id=payload["project_id"],
            key_id=None,
            outcome=Outcome.ACCEPTED,
            reason=None,
            timestamp=datetime.fromtimestamp(payload["timestamp"]),
            event_id=None,
            category=DataCategory.TRANSACTION_PROCESSED,
            quantity=quantity,
        )

    def _mark_commit_ready(self, message: Message[KafkaPayload]) -> None:
        self.__ready_to_commit[message.partition] = Position(message.next_offset, message.timestamp)

    def join(self, timeout: Optional[float] = None) -> None:
        print("JOIN")
        self._bulk_commit()

    def _bulk_commit(self) -> None:
        print("self.commit: ", self.__commit)
        print("ready to commit: ", self.__ready_to_commit)
        self.__commit(self.__ready_to_commit)
        self.__ready_to_commit = {}
