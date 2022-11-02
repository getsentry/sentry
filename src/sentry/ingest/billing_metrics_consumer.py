from __future__ import annotations

import logging
import time
from collections import deque
from concurrent.futures import Future
from datetime import datetime, timedelta
from typing import (
    Any,
    Callable,
    Deque,
    Mapping,
    MutableMapping,
    NamedTuple,
    Optional,
    Sequence,
    TypedDict,
    Union,
    cast,
)

from arroyo import Topic
from arroyo.backends.kafka import KafkaConsumer, KafkaPayload, KafkaProducer
from arroyo.backends.kafka.configuration import (
    build_kafka_configuration,
    build_kafka_consumer_configuration,
)
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.abstract import MessageRejected
from arroyo.types import Message, Partition, Position
from django.conf import settings

from sentry.constants import DataCategory
from sentry.sentry_metrics.indexer.strings import TRANSACTION_METRICS_NAMES
from sentry.utils import json, metrics
from sentry.utils.kafka_config import get_kafka_consumer_cluster_options
from sentry.utils.outcomes import Outcome

logger = logging.getLogger(__name__)
logger.setLevel(logging.WARNING)


def get_metrics_billing_consumer(
    group_id: str,
    auto_offset_reset: str,
    force_topic: Union[str, None],
    force_cluster: Union[str, None],
    max_batch_size: int,
    max_batch_time: int,
) -> StreamProcessor[KafkaPayload]:
    topic = force_topic or settings.KAFKA_SNUBA_GENERIC_METRICS
    bootstrap_servers = _get_bootstrap_servers(topic, force_cluster)

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
        processor_factory=BillingMetricsConsumerStrategyFactory(max_batch_size, max_batch_time),
    )


def _get_bootstrap_servers(topic: str, force_cluster: Optional[str]) -> Sequence[str]:
    cluster = force_cluster or settings.KAFKA_TOPICS[topic]["cluster"]

    options = get_kafka_consumer_cluster_options(cluster)
    servers = options["bootstrap.servers"]
    if isinstance(servers, (list, tuple)):
        return servers
    return [servers]


class BillingMetricsConsumerStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(self, max_batch_size: int, max_batch_time: int):
        self.__max_batch_size = max_batch_size
        self.__max_batch_time = max_batch_time

    def create_with_partitions(
        self,
        commit: Callable[[Mapping[Partition, Position]], None],
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return BillingTxCountMetricConsumerStrategy(
            commit, self.__max_batch_size, self.__max_batch_time
        )


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

    #: The ID of the metric used to count transactions
    metric_id = TRANSACTION_METRICS_NAMES["d:transactions/duration@millisecond"]

    def __init__(
        self,
        commit: Callable[[Mapping[Partition, Position]], None],
        max_batch_size: int,
        max_batch_time: int,
    ) -> None:
        self._closed: bool = False
        self._commit = commit
        # XXX(iker): these max* variables currently don't behave as maximums,
        # but rather minimums. We should fix this at some point.
        self._max_batch_size: int = max_batch_size
        self._max_batch_time: timedelta = timedelta(milliseconds=max_batch_time)

        self._billing_topic = Topic(settings.KAFKA_OUTCOMES_BILLING)
        self._billing_producer = self._get_billing_producer()
        # Especially on incidents generating big backlogs, we must expect a lot
        # of removals from the beginning of a big FIFO. A dequeue provides O(1)
        # time on removing items from the beginning; while a regular list takes
        # O(n).
        self._ongoing_billing_outcomes: Deque[MetricsBucketBilling] = deque()
        self._ready_to_commit: MutableMapping[Partition, Position] = {}
        self._last_commit_time: datetime = datetime.now()
        self._messages_ready_since_last_commit: int = 0

    def _get_billing_producer(self) -> KafkaProducer:
        servers = _get_bootstrap_servers(topic=self._billing_topic.name, force_cluster=None)
        return KafkaProducer(
            build_kafka_configuration(default_config={}, bootstrap_servers=servers)
        )

    def poll(self) -> None:
        if self._should_commit():
            self._bulk_commit()

    def _should_commit(self) -> bool:
        self._mark_commit_ready()

        if not self._ready_to_commit:
            return False
        if self._messages_ready_since_last_commit >= self._max_batch_size:
            return True
        if self._last_commit_time + self._max_batch_time <= datetime.now():
            return True
        return False

    def _mark_commit_ready(self) -> None:
        """Removes completed futures at the beginning of
        ongoing_billing_outcomes and adds them to ready_to_commit.

        If a future has errored, log an error but add to ready_to_commit
        anyways.
        """
        while self._ongoing_billing_outcomes:
            produce_billing, metrics_msg = self._ongoing_billing_outcomes[0]

            if produce_billing:
                if not produce_billing.done():
                    break
                # XXX(iker): in tests .exception() may return a mock, which
                # resolves to a truthy value. Explicitly checking if it's an
                # exception removes this log from tests. We may want to improve
                # mocking in the tests and only check for a None value here.
                if isinstance(produce_billing.exception(), Exception):
                    logger.error(
                        "Async future failed in billing metrics consumer.",
                        exc_info=produce_billing.exception(),
                        extra={"offset": metrics_msg.offset},
                    )

            self._ongoing_billing_outcomes.popleft()
            self._ready_to_commit[metrics_msg.partition] = Position(
                metrics_msg.next_offset, datetime.now()
            )
            self._messages_ready_since_last_commit += 1

    def _bulk_commit(self) -> None:
        """Commits and clears the ready to commit queue."""
        if not self._ready_to_commit:
            return
        metrics.gauge(
            "billing_metrics_consumer.bulk_commit.queue_size",
            value=self._messages_ready_since_last_commit,
        )
        self._commit(self._ready_to_commit)
        self._clear_ready_queue()

    def _clear_ready_queue(self) -> int:
        """Clears the ready to commit queue and returns the amount of items dropped."""
        amount_dropped = self._messages_ready_since_last_commit
        self._ready_to_commit = {}
        self._messages_ready_since_last_commit = 0
        self._last_commit_time = datetime.now()
        return amount_dropped

    def join(self, timeout: Optional[float] = None) -> None:
        deadline = time.time() + timeout if timeout else None
        self._mark_commit_ready()
        self._bulk_commit()

        while self._ongoing_billing_outcomes:
            now = time.time()
            time_left = deadline - now if deadline else None

            if time_left is not None and time_left <= 0:
                items_left = self._messages_ready_since_last_commit + len(
                    self._ongoing_billing_outcomes
                )
                logger.warning(f"join timed out, items left in the queue: {items_left}")
                break

            future, metrics_msg = self._ongoing_billing_outcomes[0]
            do_commit = True
            if future:
                try:
                    future.result(time_left)
                except Exception:
                    logger.error(
                        "Async future failed in billing metrics consumer.",
                        exc_info=future.exception(),
                        extra={"offset": metrics_msg.offset},
                    )
                    # Don't commit the future when it fails -- if no futher messages
                    # are committed before shutting down the consumer, new consumers
                    # will process the current offset again.
                    do_commit = False
                    self._ongoing_billing_outcomes.popleft()

            if do_commit:
                self._mark_commit_ready()
                self._bulk_commit()

    def terminate(self) -> None:
        self.close()
        amount_dropped = len(self._ongoing_billing_outcomes)
        while self._ongoing_billing_outcomes:
            ongoing_work, _ = self._ongoing_billing_outcomes.popleft()
            if ongoing_work:
                ongoing_work.cancel()
        amount_dropped += self._clear_ready_queue()
        if amount_dropped > 0:
            logger.warning(f"terminated, items dropped: {amount_dropped}")

    def close(self) -> None:
        self._closed = True

    def submit(self, message: Message[KafkaPayload]) -> None:
        if self._closed:
            raise MessageRejected("Consumer is closed, no new messages are accepted.")

        bucket_payload = self._get_bucket_payload(message)
        quantity = self._count_processed_transactions(bucket_payload)

        if quantity < 1:
            # We still want to commmit buckets that don't generate billing
            # outcomes, since the consumer has already processed them. To keep
            # the offset order when committing, we still need to go through the
            # futures queue.
            future = None
        else:
            value = json.dumps(
                {
                    "timestamp": datetime.now(),
                    "org_id": bucket_payload["org_id"],
                    "project_id": bucket_payload["project_id"],
                    "outcome": Outcome.ACCEPTED.value,
                    "category": DataCategory.TRANSACTION,
                    "quantity": quantity,
                }
            ).encode("utf-8")
            billing_payload = KafkaPayload(key=None, value=value, headers=[])
            future = self._billing_producer.produce(
                destination=self._billing_topic, payload=billing_payload
            )

        self._ongoing_billing_outcomes.append(MetricsBucketBilling(future, message))

    def _get_bucket_payload(self, message: Message[KafkaPayload]) -> MetricsBucket:
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
