from __future__ import absolute_import

import random

from datetime import datetime
from django.conf import settings
from django.core.cache import cache
from enum import IntEnum
import six
import time

from sentry import tsdb, options
from sentry.utils import json, metrics
from sentry.utils.data_filters import FILTER_STAT_KEYS_TO_VALUES
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


def decide_signals_in_consumer():
    rate = options.get("outcomes.signals-in-consumer-sample-rate")
    return rate and rate > random.random()


def decide_tsdb_in_consumer():
    rate = options.get("outcomes.tsdb-in-consumer-sample-rate")
    return rate and rate > random.random()


def _get_tsdb_cache_key(project_id, event_id):
    assert isinstance(project_id, six.integer_types)
    return "is-tsdb-incremented:{}:{}".format(project_id, event_id)


def mark_tsdb_incremented_many(items):
    """
    Remembers that TSDB was already called for an outcome.

    Sets a boolean flag in memcached to remember that
    tsdb_increments_from_outcome was already called for a particular
    event/outcome.

    This is used by the outcomes consumer to avoid double-emission.
    """
    cache.set_many(
        dict((_get_tsdb_cache_key(project_id, event_id), True) for project_id, event_id in items),
        3600,
    )


def mark_tsdb_incremented(project_id, event_id):
    mark_tsdb_incremented_many([(project_id, event_id)])


def tsdb_increments_from_outcome(org_id, project_id, key_id, outcome, reason):
    if outcome != Outcome.INVALID:
        # This simply preserves old behavior. We never counted invalid events
        # (too large, duplicate, CORS) toward regular `received` counts.
        if project_id is not None:
            yield (tsdb.models.project_total_received, project_id)
        if org_id is not None:
            yield (tsdb.models.organization_total_received, org_id)
        if key_id is not None:
            yield (tsdb.models.key_total_received, key_id)

    if outcome == Outcome.FILTERED:
        if project_id is not None:
            yield (tsdb.models.project_total_blacklisted, project_id)
        if org_id is not None:
            yield (tsdb.models.organization_total_blacklisted, org_id)
        if key_id is not None:
            yield (tsdb.models.key_total_blacklisted, key_id)

    elif outcome == Outcome.RATE_LIMITED:
        if project_id is not None:
            yield (tsdb.models.project_total_rejected, project_id)
        if org_id is not None:
            yield (tsdb.models.organization_total_rejected, org_id)
        if key_id is not None:
            yield (tsdb.models.key_total_rejected, key_id)

    if reason in FILTER_STAT_KEYS_TO_VALUES:
        if project_id is not None:
            yield (FILTER_STAT_KEYS_TO_VALUES[reason], project_id)


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
        outcomes_publisher = KafkaPublisher(settings.KAFKA_CLUSTERS[outcomes["cluster"]])

    assert isinstance(org_id, six.integer_types)
    assert isinstance(project_id, six.integer_types)
    assert isinstance(key_id, (type(None), six.integer_types))
    assert isinstance(outcome, Outcome)
    assert isinstance(timestamp, (type(None), datetime))

    timestamp = timestamp or to_datetime(time.time())

    tsdb_in_consumer = decide_tsdb_in_consumer()

    if not tsdb_in_consumer:
        increment_list = list(
            tsdb_increments_from_outcome(
                org_id=org_id, project_id=project_id, key_id=key_id, outcome=outcome, reason=reason
            )
        )

        if increment_list:
            tsdb.incr_multi(increment_list, timestamp=timestamp)

        if project_id and event_id:
            mark_tsdb_incremented(project_id, event_id)

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
            }
        ),
    )

    metrics.incr(
        "events.outcomes",
        skip_internal=True,
        tags={"outcome": outcome.name.lower(), "reason": reason},
    )
