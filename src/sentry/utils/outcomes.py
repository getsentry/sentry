from __future__ import annotations

import time
from datetime import datetime
from enum import IntEnum
from typing import Optional

from django.conf import settings

from sentry.constants import DataCategory
from sentry.utils import json, kafka_config, metrics
from sentry.utils.dates import to_datetime
from sentry.utils.pubsub import KafkaPublisher

# valid values for outcome


class Outcome(IntEnum):
    ACCEPTED = 0
    FILTERED = 1
    RATE_LIMITED = 2
    INVALID = 3
    ABUSE = 4
    CLIENT_DISCARD = 5

    def api_name(self) -> str:
        return self.name.lower()

    @classmethod
    def parse(cls, name: str) -> Outcome:
        return Outcome[name.upper()]

    def is_billing(self) -> bool:
        return self in (Outcome.ACCEPTED, Outcome.RATE_LIMITED)


outcomes_publisher: KafkaPublisher | None = None
billing_publisher: KafkaPublisher | None = None


def track_outcome(
    org_id: int,
    project_id: int,
    key_id: Optional[int],
    outcome: Outcome,
    reason: Optional[str] = None,
    timestamp: Optional[datetime] = None,
    event_id: Optional[str] = None,
    category: Optional[DataCategory] = None,
    quantity: Optional[int] = None,
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

    outcomes_config = kafka_config.get_topic_definition(settings.KAFKA_OUTCOMES)
    billing_config = kafka_config.get_topic_definition(settings.KAFKA_OUTCOMES_BILLING)
    use_billing = (
        outcome.is_billing() and settings.KAFKA_TOPICS[settings.KAFKA_OUTCOMES_BILLING] is not None
    )

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

    timestamp = timestamp or to_datetime(time.time())

    # Send billing outcomes to a dedicated topic if there is a separate
    # configuration for it. Otherwise, fall back to the regular outcomes topic.
    # This does NOT switch the producer, if both topics are on the same cluster.
    #
    # In Sentry, there is no significant difference between the classes of
    # outcome. In Sentry SaaS, they have elevated stability requirements as they
    # are used for spike protection and quota enforcement.
    topic_name = settings.KAFKA_OUTCOMES_BILLING if use_billing else settings.KAFKA_OUTCOMES

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
