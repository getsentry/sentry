from __future__ import annotations
from typing import int

import atexit
import random
import time
from collections import namedtuple
from datetime import datetime, timedelta
from enum import IntEnum
from threading import Lock

from sentry.conf.types.kafka_definition import Topic
from sentry.constants import DataCategory
from sentry.utils import json, kafka_config, metrics
from sentry.utils.dates import to_datetime
from sentry.utils.pubsub import KafkaPublisher

# Aggregation key for grouping outcomes
OutcomeKey = namedtuple(
    "OutcomeKey", ["time_bucket", "org_id", "project_id", "key_id", "outcome", "reason", "category"]
)


class OutcomeAggregator:
    def __init__(
        self,
        bucket_interval: int = 60,
        flush_interval: int = 300,
        max_batch_size: int = 10000,
        jitter: int | None = None,
    ):
        self.bucket_interval = bucket_interval
        self.flush_interval = flush_interval
        self.max_batch_size = max_batch_size

        self._buffer: dict[OutcomeKey, int] = {}
        self._lock = Lock()

        if jitter is None:
            jitter = random.randint(0, 60)

        # Add jitter to the initial flush time to prevent all replicas from flushing simultaneously
        # Default jitter is up to ~1 minute (0-60 seconds) if not specified
        self._last_flush_time = time.time() + jitter

        # since 3.13 we can rely on child processes of
        # RunTaskWithMultiprocessing to also work correctly with atexit:
        # https://github.com/python/cpython/pull/114279
        atexit.register(self._atexit_flush)

    def flush(self, force: bool = False) -> None:
        if not force:
            current_time = time.time()
            buffer_size = len(self._buffer)
            time_elapsed = current_time - self._last_flush_time

            should_flush_size = buffer_size >= self.max_batch_size
            should_flush_time = time_elapsed >= self.flush_interval

            if should_flush_size:
                metrics.incr("outcomes.flush_size")
            elif should_flush_time:
                metrics.incr("outcomes.flush_time")
            else:
                return

        with self._lock:
            if not self._buffer:
                return

            buffer_to_flush = self._buffer
            self._buffer = {}
            self._last_flush_time = time.time()

        with metrics.timer("outcomes.flush_buffer"):
            for key, aggregated_quantity in buffer_to_flush.items():
                track_outcome(
                    org_id=key.org_id,
                    project_id=key.project_id,
                    key_id=key.key_id,
                    outcome=Outcome(key.outcome),
                    reason=key.reason,
                    timestamp=to_datetime(key.time_bucket * self.bucket_interval),
                    event_id=None,
                    category=DataCategory(key.category) if key.category is not None else None,
                    quantity=aggregated_quantity,
                )

    def track_outcome_aggregated(
        self,
        org_id: int,
        project_id: int,
        key_id: int | None,
        outcome: Outcome,
        reason: str | None = None,
        timestamp: datetime | None = None,
        category: DataCategory | None = None,
        quantity: int | None = None,
    ) -> None:
        if quantity is None:
            quantity = 1

        assert isinstance(org_id, int)
        assert isinstance(project_id, int)
        assert isinstance(key_id, (type(None), int))
        assert isinstance(outcome, Outcome)
        assert isinstance(timestamp, (type(None), datetime))
        assert isinstance(category, (type(None), DataCategory))
        assert isinstance(quantity, int)

        now = to_datetime(time.time())
        timestamp = timestamp or now

        timestamp_seconds = int(timestamp.timestamp())
        time_bucket = timestamp_seconds // self.bucket_interval

        key = OutcomeKey(
            time_bucket=time_bucket,
            org_id=org_id,
            project_id=project_id,
            key_id=key_id,
            outcome=outcome.value,
            reason=reason,
            category=category.value if category is not None else None,
        )

        with self._lock:
            existing = self._buffer.get(key) or 0
            self._buffer[key] = existing + quantity

        self.flush()

    def _atexit_flush(self) -> None:
        self.flush(force=True)


# valid values for outcome


class Outcome(IntEnum):
    ACCEPTED = 0
    FILTERED = 1
    RATE_LIMITED = 2
    INVALID = 3
    ABUSE = 4
    CLIENT_DISCARD = 5
    CARDINALITY_LIMITED = 6

    def api_name(self) -> str:
        return self.name.lower()

    @classmethod
    def parse(cls, name: str) -> Outcome:
        return Outcome[name.upper()]

    def is_billing(self) -> bool:
        return self in (Outcome.ACCEPTED, Outcome.RATE_LIMITED)


outcomes_publisher: KafkaPublisher | None = None
billing_publisher: KafkaPublisher | None = None

LATE_OUTCOME_THRESHOLD = timedelta(days=1)


def track_outcome(
    org_id: int,
    project_id: int,
    key_id: int | None,
    outcome: Outcome,
    reason: str | None = None,
    timestamp: datetime | None = None,
    event_id: str | None = None,
    category: DataCategory | None = None,
    quantity: int | None = None,
) -> None:
    """
    This is a central point to track org/project counters per incoming event.
    NB: This should only ever be called once per incoming event, which means
    it should only be called at the point we know the final outcome for the
    event (invalid, rate_limited, accepted, discarded, etc.)

    This sends the "outcome" message to Kafka which is used by Snuba to serve
    data for SnubaTSDB and RedisSnubaTSDB, such as # of rate-limited/filtered
    events.
    """
    global outcomes_publisher
    global billing_publisher

    if quantity is None:
        quantity = 1

    assert isinstance(org_id, int)
    assert isinstance(project_id, int)
    assert isinstance(key_id, (type(None), int))
    assert isinstance(outcome, Outcome)
    assert isinstance(timestamp, (type(None), datetime))
    assert isinstance(category, (type(None), DataCategory))
    assert isinstance(quantity, int)

    outcomes_config = kafka_config.get_topic_definition(Topic.OUTCOMES)
    billing_config = kafka_config.get_topic_definition(Topic.OUTCOMES_BILLING)

    use_billing = outcome.is_billing()

    # Create a second producer instance only if the cluster differs. Otherwise,
    # reuse the same producer and just send to the other topic.
    if use_billing and billing_config["cluster"] != outcomes_config["cluster"]:
        if billing_publisher is None:
            cluster_name = billing_config["cluster"]
            billing_publisher = KafkaPublisher(
                kafka_config.get_kafka_producer_cluster_options(cluster_name)
            )
        publisher = billing_publisher

    else:
        if outcomes_publisher is None:
            cluster_name = outcomes_config["cluster"]
            outcomes_publisher = KafkaPublisher(
                kafka_config.get_kafka_producer_cluster_options(cluster_name)
            )
        publisher = outcomes_publisher

    now = to_datetime(time.time())
    timestamp = timestamp or now

    # Send billing outcomes to a dedicated topic.
    topic_name = (
        billing_config["real_topic_name"] if use_billing else outcomes_config["real_topic_name"]
    )

    # Send a snuba metrics payload.
    publisher.publish(
        topic_name,
        json.dumps(
            {
                "timestamp": timestamp,
                "org_id": org_id,
                "project_id": project_id,
                "key_id": key_id,
                "outcome": outcome.value,
                "reason": reason,
                "event_id": event_id,
                "category": category,
                "quantity": quantity,
            }
        ),
    )

    if now - timestamp.replace(tzinfo=now.tzinfo) > LATE_OUTCOME_THRESHOLD:
        metrics.incr(
            "events.outcomes.late",
            skip_internal=True,
            tags={
                "outcome": outcome.name.lower(),
                "reason": reason,
                "category": category.api_name() if category is not None else "null",
                "topic": topic_name,
            },
        )

    metrics.incr(
        "events.outcomes",
        skip_internal=True,
        tags={
            "outcome": outcome.name.lower(),
            "reason": reason,
            "category": category.api_name() if category is not None else "null",
            "topic": topic_name,
        },
    )
