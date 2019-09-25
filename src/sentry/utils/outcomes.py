from __future__ import absolute_import

from datetime import datetime
from django.conf import settings
from enum import IntEnum
import random
import six
import time

from sentry import tsdb, options
from sentry.utils import json, metrics
from sentry.utils.data_filters import FILTER_STAT_KEYS_TO_VALUES
from sentry.utils.dates import to_datetime
from sentry.utils.pubsub import QueuedPublisherService, KafkaPublisher

# valid values for outcome


class Outcome(IntEnum):
    ACCEPTED = 0
    FILTERED = 1
    RATE_LIMITED = 2
    INVALID = 3
    ABUSE = 4


outcomes = settings.KAFKA_TOPICS[settings.KAFKA_OUTCOMES]
outcomes_publisher = None


def track_outcome(org_id, project_id, key_id, outcome, reason=None, timestamp=None, event_id=None):
    """
    This is a central point to track org/project counters per incoming event.
    NB: This should only ever be called once per incoming event, which means
    it should only be called at the point we know the final outcome for the
    event (invalid, rate_limited, accepted, discarded, etc.)

    This increments all the relevant legacy RedisTSDB counters, as well as
    sending a single metric event to Kafka which can be used to reconstruct the
    counters with SnubaTSDB.
    """
    global outcomes_publisher
    if outcomes_publisher is None:
        outcomes_publisher = QueuedPublisherService(
            KafkaPublisher(settings.KAFKA_CLUSTERS[outcomes["cluster"]])
        )

    assert isinstance(org_id, six.integer_types)
    assert isinstance(project_id, six.integer_types)
    assert isinstance(key_id, (type(None), six.integer_types))
    assert isinstance(outcome, Outcome)
    assert isinstance(timestamp, (type(None), datetime))

    timestamp = timestamp or to_datetime(time.time())
    increment_list = []
    if outcome != Outcome.INVALID:
        # This simply preserves old behavior. We never counted invalid events
        # (too large, duplicate, CORS) toward regular `received` counts.
        increment_list.extend(
            [
                (tsdb.models.project_total_received, project_id),
                (tsdb.models.organization_total_received, org_id),
                (tsdb.models.key_total_received, key_id),
            ]
        )

    if outcome == Outcome.FILTERED:
        increment_list.extend(
            [
                (tsdb.models.project_total_blacklisted, project_id),
                (tsdb.models.organization_total_blacklisted, org_id),
                (tsdb.models.key_total_blacklisted, key_id),
            ]
        )
    elif outcome == Outcome.RATE_LIMITED:
        increment_list.extend(
            [
                (tsdb.models.project_total_rejected, project_id),
                (tsdb.models.organization_total_rejected, org_id),
                (tsdb.models.key_total_rejected, key_id),
            ]
        )

    if reason in FILTER_STAT_KEYS_TO_VALUES:
        increment_list.append((FILTER_STAT_KEYS_TO_VALUES[reason], project_id))

    increment_list = [(model, key) for model, key in increment_list if key is not None]
    if increment_list:
        tsdb.incr_multi(increment_list, timestamp=timestamp)

    # Send a snuba metrics payload.
    if random.random() <= options.get("snuba.track-outcomes-sample-rate"):
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
                }
            ),
        )

    metrics.incr(
        "events.outcomes",
        skip_internal=True,
        tags={"outcome": outcome.name.lower(), "reason": reason},
    )
