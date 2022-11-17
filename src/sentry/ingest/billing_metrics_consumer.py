from __future__ import annotations

import logging
import time
from collections import deque
from concurrent.futures import Future
from datetime import datetime
from typing import Any, Deque, Dict, Mapping, NamedTuple, Optional, Sequence, TypedDict, cast

from arroyo import Topic
from arroyo.backends.kafka import KafkaConsumer, KafkaPayload, KafkaProducer
from arroyo.backends.kafka.configuration import (
    build_kafka_configuration,
    build_kafka_consumer_configuration,
)
from arroyo.commit import CommitPolicy
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.abstract import MessageRejected
from arroyo.types import Commit, Message, Partition, Position
from django.conf import settings

from sentry.constants import DataCategory
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.utils import json
from sentry.utils.kafka_config import get_kafka_consumer_cluster_options
from sentry.utils.outcomes import Outcome, track_outcome_custom_publish

logger = logging.getLogger(__name__)


def get_metrics_billing_consumer(
    group_id: str,
    auto_offset_reset: str,
    max_batch_size: int,
    max_batch_time: int,
) -> StreamProcessor[KafkaPayload]:
    topic = settings.KAFKA_SNUBA_GENERIC_METRICS
    cluster = settings.KAFKA_TOPICS[topic]["cluster"]
    bootstrap_servers = _get_bootstrap_servers(cluster)

    batch_time_secs = max_batch_time / 1000
    commit_policy = CommitPolicy(
        min_commit_frequency_sec=batch_time_secs, min_commit_messages=max_batch_size
    )

    return StreamProcessor(
        consumer=KafkaConsumer(
            build_kafka_consumer_configuration(
                default_config={},
                group_id=group_id,
                auto_offset_reset=auto_offset_reset,
                bootstrap_servers=bootstrap_servers,
            ),
        ),
        topic=Topic(topic),
        processor_factory=BillingMetricsConsumerStrategyFactory(),
        commit_policy=commit_policy,
    )


def _get_bootstrap_servers(cluster: str) -> Sequence[str]:
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
        return BillingTxCountMetricConsumerStrategy(commit, max_buffer_size=10_000)


class MetricsBucket(TypedDict):
    """
    Metrics bucket as decoded from kafka.

    Only defines the fields that are relevant for this consumer."""

    org_id: int
    project_id: int
    metric_id: int
    timestamp: int
    value: Any


class MetricsBucketBilling(NamedTuple):
    #: None represents no billing outcomes. The instance still exists to commit
    # the metric bucket.
    billing_future: Optional[Future[Message[KafkaPayload]]]
    metrics_msg: Message[KafkaPayload]


class BillingTxCountMetricConsumerStrategy(ProcessingStrategy[KafkaPayload]):
    """A metrics consumer that generates a billing outcome for each processed
    transaction, processing a bucket at a time. The transaction count is
    computed from the amount of values from `d:transactions/duration@millisecond`
    buckets.
    """

    counter_metric_name = "d:transactions/duration@millisecond"

    def __init__(
        self,
        commit: Commit,
        max_buffer_size: int,
    ) -> None:
        self._closed: bool = False
        self._commit = commit

        self._producers: Dict[str, KafkaProducer] = {}
        # Especially on incidents generating big backlogs, we must expect a lot
        # of removals from the beginning of a big FIFO. A dequeue provides O(1)
        # time on removing items from the beginning; while a regular list takes
        # O(n).
        self._ongoing_billing_outcomes: Deque[MetricsBucketBilling] = deque()
        self._max_buffer_size = max_buffer_size

    def poll(self) -> None:
        while self._ongoing_billing_outcomes:
            self._process_metrics_billing_bucket(timeout=None)

    def _process_metrics_billing_bucket(
        self, timeout: Optional[float] = None, force: bool = False
    ) -> None:
        """
        Takes the first billing outcome from the queue and if it's completed,
        commits the metrics bucket.

        When a future has thrown an exception, logs it and commits the bucket
        anyway. wait_time is used to wait on the future to finish; if `None` is
        provided and the future is not completed, no action is taken.
        """
        if len(self._ongoing_billing_outcomes) < 1:
            return

        billing_future, metrics_msg = self._ongoing_billing_outcomes[0]
        if billing_future:
            try:
                if not timeout and not billing_future.done():
                    return
                billing_future.result(timeout)
            except Exception:
                logger.error(
                    "Async future failed in billing metrics consumer.",
                    exc_info=billing_future.exception(),
                    extra={"offset": metrics_msg.offset},
                )

        self._ongoing_billing_outcomes.popleft()
        mapping = {metrics_msg.partition: Position(metrics_msg.next_offset, datetime.now())}
        self._commit(mapping, force)

    def join(self, timeout: Optional[float] = None) -> None:
        deadline = time.time() + timeout if timeout else None

        while self._ongoing_billing_outcomes:
            now = time.time()
            time_left = deadline - now if deadline else None

            if time_left is not None and time_left <= 0:
                logger.warning(
                    f"join timed out, items left in the queue: {len(self._ongoing_billing_outcomes)}"
                )
                break

            self._process_metrics_billing_bucket(time_left, force=True)

        self._close_producers()

    def terminate(self) -> None:
        self.close()

        if len(self._ongoing_billing_outcomes) > 0:
            logger.warning(f"terminated, items dropped: {len(self._ongoing_billing_outcomes)}")
        while self._ongoing_billing_outcomes:
            ongoing_work, _ = self._ongoing_billing_outcomes.popleft()
            if ongoing_work:
                ongoing_work.cancel()

        self._close_producers()

    def _close_producers(self) -> None:
        for producer in self._producers.values():
            producer.close()

    def close(self) -> None:
        self._closed = True

    def submit(self, message: Message[KafkaPayload]) -> None:
        assert not self._closed

        if len(self._ongoing_billing_outcomes) >= self._max_buffer_size:
            raise MessageRejected

        bucket_payload = self._get_bucket_payload(message)
        org_id = bucket_payload["org_id"]
        quantity = self._count_processed_transactions(org_id, bucket_payload)

        if quantity < 1:
            # We still want to commmit buckets that don't generate billing
            # outcomes, since the consumer has already processed them. To keep
            # the offset order when committing, we still need to go through the
            # futures queue.
            future = None
        else:
            future = track_outcome_custom_publish(
                self._produce,
                org_id=org_id,
                project_id=bucket_payload["project_id"],
                key_id=None,
                outcome=Outcome.ACCEPTED,
                reason=None,
                timestamp=datetime.now(),
                event_id=None,
                category=DataCategory.TRANSACTION,
                quantity=quantity,
            )

        self._ongoing_billing_outcomes.append(MetricsBucketBilling(future, message))

    def _get_bucket_payload(self, message: Message[KafkaPayload]) -> MetricsBucket:
        payload = json.loads(message.payload.value.decode("utf-8"), use_rapid_json=True)
        return cast(MetricsBucket, payload)

    def _count_processed_transactions(self, org_id: int, bucket_payload: MetricsBucket) -> int:
        counter_metric_id = indexer.resolve(
            UseCaseKey.PERFORMANCE, org_id, self.counter_metric_name
        )
        if bucket_payload["metric_id"] != counter_metric_id:
            return 0

        value = bucket_payload["value"]
        try:
            return len(value)
        except TypeError:
            # Unexpected value type for this metric ID, skip.
            return 0

    def _produce(
        self, cluster_name: str, topic_name: str, payload: str
    ) -> Future[Message[KafkaPayload]]:
        if cluster_name not in self._producers:
            self._producers[cluster_name] = self._get_billing_producer(cluster_name)

        billing_payload = KafkaPayload(key=None, value=payload.encode("utf-8"), headers=[])
        return self._producers[cluster_name].produce(
            destination=Topic(topic_name),
            payload=billing_payload,
        )

    def _get_billing_producer(self, cluster_name: str) -> KafkaProducer:
        servers = _get_bootstrap_servers(cluster_name)
        return KafkaProducer(
            build_kafka_configuration(default_config={}, bootstrap_servers=servers)
        )
