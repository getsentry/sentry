import logging
from datetime import datetime, timezone
from typing import Any, Mapping, Optional, TypedDict, Union, cast

from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies import (
    CommitOffsets,
    ProcessingStrategy,
    ProcessingStrategyFactory,
)
from arroyo.types import Commit, Message, Partition
from typing_extensions import NotRequired

from sentry.constants import DataCategory
from sentry.sentry_metrics.indexer.strings import SHARED_TAG_STRINGS, TRANSACTION_METRICS_NAMES
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import reverse_resolve_tag_value
from sentry.utils import json
from sentry.utils.outcomes import Outcome, track_outcome

logger = logging.getLogger(__name__)


class BillingMetricsConsumerStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return BillingTxCountMetricConsumerStrategy(CommitOffsets(commit))


class MetricsBucket(TypedDict):
    """
    Metrics bucket as decoded from kafka.

    Only defines the fields that are relevant for this consumer."""

    org_id: int
    project_id: int
    metric_id: int
    timestamp: int
    value: Any
    tags: Union[Mapping[str, str], Mapping[str, int]]
    # not used here but allows us to use the TypedDict for assignments
    type: NotRequired[str]


class BillingTxCountMetricConsumerStrategy(ProcessingStrategy[KafkaPayload]):
    """A metrics consumer that generates a billing outcome for each processed
    transaction, processing a bucket at a time. The transaction count is
    directly taken from the `c:transactions/usage@none` counter metric.
    """

    #: The ID of the metric used to count transactions
    metric_id = TRANSACTION_METRICS_NAMES["c:transactions/usage@none"]
    profile_tag_key = str(SHARED_TAG_STRINGS["has_profile"])

    def __init__(self, next_step: ProcessingStrategy[Any]) -> None:
        self.__next_step = next_step
        self.__closed = False

    def poll(self) -> None:
        self.__next_step.poll()

    def terminate(self) -> None:
        self.close()

    def close(self) -> None:
        self.__closed = True
        self.__next_step.close()

    def submit(self, message: Message[KafkaPayload]) -> None:
        assert not self.__closed

        payload = self._get_payload(message)
        self._produce_billing_outcomes(payload)
        self.__next_step.submit(message)

    def _get_payload(self, message: Message[KafkaPayload]) -> MetricsBucket:
        payload = json.loads(message.payload.value.decode("utf-8"), use_rapid_json=True)
        return cast(MetricsBucket, payload)

    def _count_processed_items(self, bucket_payload: MetricsBucket) -> Mapping[DataCategory, int]:
        if bucket_payload["metric_id"] != self.metric_id:
            return {}
        value = bucket_payload["value"]
        try:
            quantity = max(int(value), 0)
        except TypeError:
            # Unexpected value type for this metric ID, skip.
            return {}

        items = {DataCategory.TRANSACTION: quantity}

        if self._has_profile(bucket_payload):
            # The bucket is tagged with the "has_profile" tag,
            # so we also count the quantity of this bucket towards profiles.
            # This assumes a "1 to 0..1" relationship between transactions and profiles.
            items[DataCategory.PROFILE] = quantity

        return items

    def _has_profile(self, bucket: MetricsBucket) -> bool:
        return bool(
            (tag_value := bucket["tags"].get(self.profile_tag_key))
            and "true"
            == reverse_resolve_tag_value(UseCaseID.TRANSACTIONS, bucket["org_id"], tag_value)
        )

    def _produce_billing_outcomes(self, payload: MetricsBucket) -> None:
        for category, quantity in self._count_processed_items(payload).items():
            self._produce_billing_outcome(
                org_id=payload["org_id"],
                project_id=payload["project_id"],
                category=category,
                quantity=quantity,
            )

    def _produce_billing_outcome(
        self, *, org_id: int, project_id: int, category: DataCategory, quantity: int
    ) -> None:
        if quantity < 1:
            return

        # track_outcome does not guarantee to deliver the outcome, making this
        # an at-most-once delivery.
        #
        # If it turns out that we drop too many outcomes on shutdown,
        # we may have to revisit this part to achieve a
        # better approximation of exactly-once delivery.
        track_outcome(
            org_id=org_id,
            project_id=project_id,
            key_id=None,
            outcome=Outcome.ACCEPTED,
            reason=None,
            timestamp=datetime.now(timezone.utc),
            event_id=None,
            category=category,
            quantity=quantity,
        )

    def join(self, timeout: Optional[float] = None) -> None:
        self.__next_step.join(timeout)
