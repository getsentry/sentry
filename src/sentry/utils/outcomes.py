from __future__ import absolute_import

from datetime import datetime
from django.conf import settings
from enum import IntEnum
import six
import time

from sentry.constants import DataCategory
from sentry.utils import json, metrics, kafka_config
from sentry.utils.dates import to_datetime
from sentry.utils.pubsub import KafkaPublisher

# valid values for outcome


class Outcome(IntEnum):
    ACCEPTED = 0
    FILTERED = 1
    RATE_LIMITED = 2
    INVALID = 3
    ABUSE = 4


outcomes = settings.KAFKA_TOPICS[settings.KAFKA_OUTCOMES]
outcomes_publisher = None


def track_outcome(
    org_id,
    project_id,
    key_id,
    outcome,
    reason=None,
    timestamp=None,
    event_id=None,
    category=None,
    quantity=None,
):
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
    if outcomes_publisher is None:
        cluster_name = outcomes["cluster"]
        outcomes_publisher = KafkaPublisher(
            kafka_config.get_kafka_producer_cluster_options(cluster_name)
        )

    if quantity is None:
        quantity = 1

    assert isinstance(org_id, six.integer_types)
    assert isinstance(project_id, six.integer_types)
    assert isinstance(key_id, (type(None), six.integer_types))
    assert isinstance(outcome, Outcome)
    assert isinstance(timestamp, (type(None), datetime))
    assert isinstance(category, (type(None), DataCategory))
    assert isinstance(quantity, int)

    timestamp = timestamp or to_datetime(time.time())

    # Send a snuba metrics payload.
    outcomes_publisher.publish(
        outcomes["topic"],
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
        },
    )
