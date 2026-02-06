import logging
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any, cast

import orjson
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies import (
    CommitOffsets,
    ProcessingStrategy,
    ProcessingStrategyFactory,
)
from arroyo.types import Commit, Message, Partition
from sentry_kafka_schemas.schema_types.snuba_generic_metrics_v1 import GenericMetric

from sentry.constants import DataCategory
from sentry.sentry_metrics.indexer.strings import SHARED_TAG_STRINGS, SPAN_METRICS_NAMES
from sentry.utils.outcomes import Outcome, track_outcome

logger = logging.getLogger(__name__)

# 7 days of TTL.
CACHE_TTL_IN_SECONDS = 60 * 60 * 24 * 7


class BillingMetricsConsumerStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return BillingTxCountMetricConsumerStrategy(CommitOffsets(commit))


class BillingTxCountMetricConsumerStrategy(ProcessingStrategy[KafkaPayload]):
    """A metrics consumer that generates an accepted outcome for each processed (as opposed to indexed)
    transaction or span, processing a bucket at a time. The transaction / span count is
    directly taken from the `c:transactions/usage@none` or `c:spans/usage@none` counter metric.

    See https://develop.sentry.dev/application-architecture/dynamic-sampling/outcomes/.
    """

    span_metric_id = SPAN_METRICS_NAMES["c:spans/usage@none"]
    span_is_segment_tag = str(SHARED_TAG_STRINGS["is_segment"])

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

        self._produce_outcomes(payload)

        self.__next_step.submit(message)

    def _get_payload(self, message: Message[KafkaPayload]) -> GenericMetric:
        payload = orjson.loads(message.payload.value)
        return cast(GenericMetric, payload)

    def _count_processed_items(self, generic_metric: GenericMetric) -> Mapping[DataCategory, int]:
        """
        Solely calculates the outcome counts based on the span usage metric.

        Identifies the transaction count based on the `is_segment` tag on the usage metric.
        """
        if generic_metric["metric_id"] != self.span_metric_id:
            return {}

        value = generic_metric["value"]
        try:
            quantity = max(int(value), 0)  # type: ignore[arg-type]
        except TypeError:
            # Unexpected value type for this metric ID, skip.
            return {}

        items = {DataCategory.SPAN: quantity}
        if self.has_is_segment_tag(generic_metric):
            items[DataCategory.TRANSACTION] = quantity

        return items

    def _produce_outcomes(self, generic_metric: GenericMetric) -> None:
        for category, quantity in self._count_processed_items(generic_metric).items():
            self._produce_accepted_outcome(
                org_id=generic_metric["org_id"],
                project_id=generic_metric["project_id"],
                category=category,
                quantity=quantity,
            )

    def _produce_accepted_outcome(
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

    def has_is_segment_tag(self, generic_metric: GenericMetric) -> bool:
        return generic_metric["tags"].get(self.span_is_segment_tag) == "true"

    def join(self, timeout: float | None = None) -> None:
        self.__next_step.join(timeout)
