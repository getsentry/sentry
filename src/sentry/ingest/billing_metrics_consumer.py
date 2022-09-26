from datetime import datetime
from typing import Callable, Dict, Mapping, Optional

from arroyo import Topic
from arroyo.backends.kafka import KafkaConsumer, KafkaPayload
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.types import Message, Partition, Position
from django.conf import settings

from sentry.constants import DataCategory
from sentry.sentry_metrics.indexer.strings import TRANSACTION_METRICS_NAMES
from sentry.utils import json
from sentry.utils.kafka_config import get_kafka_consumer_cluster_options
from sentry.utils.outcomes import Outcome, track_outcome


def get_metrics_billing_consumer(
    topic: str,
    group_id: str,
    auto_offset_reset: str,
    **options,
) -> StreamProcessor[KafkaPayload]:
    # TODO: support force_topic and force_cluster
    cluster_name = settings.KAFKA_TOPICS[topic]["cluster"]

    return StreamProcessor(
        consumer=KafkaConsumer(
            get_kafka_consumer_cluster_options(
                cluster_name=cluster_name,
                override_params={
                    "enable.auto.commit": False,
                    "enable.auto.offset.store": False,
                    "auto.offset.reset": auto_offset_reset,
                    "group.id": group_id,
                },
            )
        ),
        topic=Topic(topic),
        processor_factory=BillingMetricsConsumerStrategyFactory(),
    )


class BillingMetricsConsumerStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def create_with_partitions(
        self,
        commit: Callable[[Mapping[Partition, Position]], None],
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return BillingTxCountMetricConsumerStrategy(commit)


class BillingTxCountMetricConsumerStrategy(ProcessingStrategy[KafkaPayload]):
    """A metrics consumer that generates a billing outcome for each processed
    transaction, processing a bucket at a time. The transaction count is
    computed from the amount of values from `d:transactions/duration@millisecond`
    buckets.
    """

    def __init__(self, commit: Callable[[Mapping[Partition, Position]], None]) -> None:
        self.counter_metric_id = TRANSACTION_METRICS_NAMES["d:transactions/duration@millisecond"]
        self.__commit = commit
        self.__ready_to_commit: Mapping[Partition, Position] = {}
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
        num_processed_transactions = self._count_processed_transactions(payload)
        self._produce_billing_outcomes(payload, num_processed_transactions)
        self._mark_commit_ready(message)

    def _get_payload(self, message: Message[KafkaPayload]) -> Dict:
        return json.loads(message.payload.value.decode("utf-8"), use_rapid_json=True)

    def _count_processed_transactions(self, bucket_payload: Dict) -> int:
        if bucket_payload["metric_id"] != self.counter_metric_id:
            return 0
        return len(bucket_payload["value"])

    def _produce_billing_outcomes(self, payload: Dict, amount: int) -> None:
        if amount < 1:
            return

        track_outcome(
            org_id=payload.get("org_id"),
            project_id=payload.get("project_id"),
            key_id=None,
            outcome=Outcome.ACCEPTED,
            reason=None,
            timestamp=datetime.fromtimestamp(payload.get("timestamp")),
            event_id=None,
            category=DataCategory.TRANSACTION_PROCESSED,
            quantity=amount,
        )

    def _mark_commit_ready(self, message: Message[KafkaPayload]):
        self.__ready_to_commit[message.partition] = Position(message.next_offset, message.timestamp)

    def join(self, timeout: Optional[float] = None) -> None:
        self._bulk_commit()

    def _bulk_commit(self) -> None:
        self.__commit(self.__ready_to_commit)
        self.__ready_to_commit = {}
