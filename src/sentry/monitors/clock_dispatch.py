from __future__ import annotations

import logging
from collections import Counter
from collections.abc import Sequence
from datetime import datetime, timedelta, timezone

from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from django.conf import settings
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.monitors_clock_tick_v1 import ClockTick

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.utils import metrics, redis
from sentry.utils.arroyo_producer import SingletonProducer
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

logger = logging.getLogger("sentry")

# This key is used to store the last timestamp that the tasks were triggered.
MONITOR_TASKS_LAST_TRIGGERED_KEY = "sentry.monitors.last_tasks_ts"

# This key is used to store the hashmap of Mapping[PartitionKey, Timestamp]
MONITOR_TASKS_PARTITION_CLOCKS = "sentry.monitors.partition_clocks"

# This key is used to record historical date about the volume of check-ins.
MONITOR_VOLUME_HISTORY = "sentry.monitors.volume_history:{}"

# We record 30 days worth of historical data for each minute of check-ins.
MONITOR_VOLUME_RETENTION = timedelta(days=30)

CLOCK_TICK_CODEC: Codec[ClockTick] = get_topic_codec(Topic.MONITORS_CLOCK_TICK)


def _int_or_none(s: str | None) -> int | None:
    if s is None:
        return None
    else:
        return int(s)


def _get_producer() -> KafkaProducer:
    cluster_name = get_topic_definition(Topic.MONITORS_CLOCK_TICK)["cluster"]
    producer_config = get_kafka_producer_cluster_options(cluster_name)
    producer_config.pop("compression.type", None)
    producer_config.pop("message.max.bytes", None)
    return KafkaProducer(build_kafka_configuration(default_config=producer_config))


_clock_tick_producer = SingletonProducer(_get_producer)


def _dispatch_tick(ts: datetime):
    """
    Dispatch a clock tick which will trigger monitor tasks.

    These tasks are triggered via the consumer processing check-ins. This
    allows the monitor tasks to be synchronized to any backlog of check-ins
    that are being processed.

    To ensure these tasks are always triggered there is an additional celery
    beat task that produces a clock pulse message into the topic that can be
    used to trigger these tasks when there is a low volume of check-ins. It is
    however, preferred to have a high volume of check-ins, so we do not need to
    rely on celery beat, which in some cases may fail to trigger (such as in
    sentry.io, when we deploy we restart the celery beat worker and it will
    skip any tasks it missed)
    """
    if settings.SENTRY_EVENTSTREAM != "sentry.eventstream.kafka.KafkaEventStream":
        # XXX(epurkhiser): Unclear what we want to do if we're not using kafka
        return

    message: ClockTick = {"ts": ts.timestamp()}
    payload = KafkaPayload(None, CLOCK_TICK_CODEC.encode(message), [])

    topic = get_topic_definition(Topic.MONITORS_CLOCK_TICK)["real_topic_name"]
    _clock_tick_producer.produce(ArroyoTopic(topic), payload)


def _make_reference_ts(ts: datetime):
    """
    Produce a timestamp number with the seconds and microsecond removed
    """
    return int(ts.replace(second=0, microsecond=0).timestamp())


def update_check_in_volume(ts: datetime):
    """
    Increment a counter for this particular timestamp trimmed down to the
    minute.

    This counter will be used as historical data to help incidate if we may
    have had some data-loss (due to an incident) and would want to tick our
    clock in a mode where misses and time-outs are created as "unknown".
    """
    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)

    reference_ts = _make_reference_ts(ts)
    key = MONITOR_VOLUME_HISTORY.format(reference_ts)

    pipeline = redis_client.pipeline()
    pipeline.incr(key, amount=1)
    pipeline.expire(key, MONITOR_VOLUME_RETENTION)
    pipeline.execute()


def bulk_update_check_in_volume(ts_list: Sequence[datetime]):
    """
    Increment counters for a list of check-in timestamps. Each timestamp will be
    trimmed to the minute and grouped appropriately
    """
    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)

    # Group timestamps down to the minute
    for reference_ts, count in Counter(_make_reference_ts(ts) for ts in ts_list).items():
        key = MONITOR_VOLUME_HISTORY.format(reference_ts)

        pipeline = redis_client.pipeline()
        pipeline.incr(key, amount=count)
        pipeline.expire(key, MONITOR_VOLUME_RETENTION)
        pipeline.execute()


def try_monitor_clock_tick(ts: datetime, partition: int):
    """
    Handles triggering the monitor tasks when we've rolled over the minute.

    We keep a reference to the most recent timestamp for each partition and use
    the slowest partition as our reference time. This ensures all partitions
    have been synchronized before ticking our clock.

    This function is called by our consumer processor
    """
    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)

    # Trim the timestamp seconds off, these tasks are run once per minute and
    # should have their timestamp clamped to the minute.
    reference_ts = _make_reference_ts(ts)

    # Store the current clock value for this partition.
    redis_client.zadd(
        name=MONITOR_TASKS_PARTITION_CLOCKS,
        mapping={f"part-{partition}": reference_ts},
    )

    # Find the slowest partition from our sorted set of partitions, where the
    # clock is the score.
    slowest_partitions: list[tuple[str, float]] = redis_client.zrange(
        name=MONITOR_TASKS_PARTITION_CLOCKS,
        withscores=True,
        start=0,
        end=0,
    )

    # the first tuple is the slowest (part-<id>, score), the score is the
    # timestamp. Use `int()` to keep the timestamp (score) as an int
    slowest_part_ts = int(slowest_partitions[0][1])

    precheck_last_ts = _int_or_none(redis_client.get(MONITOR_TASKS_LAST_TRIGGERED_KEY))

    # If we have the same or an older timestamp from the most recent tick there
    # is nothing to do, we've already handled this tick.
    #
    # The scenario where the slowest_part_ts is older may happen when our
    # MONITOR_TASKS_PARTITION_CLOCKS set did not know about every partition the
    # topic is responsible for. Older check-ins may be processed after newer
    # ones in different topics. This should only happen if redis loses state.
    if precheck_last_ts is not None and precheck_last_ts >= slowest_part_ts:
        return

    # GETSET is atomic. This is critical to avoid another consumer also
    # processing the same tick.
    last_ts = _int_or_none(redis_client.getset(MONITOR_TASKS_LAST_TRIGGERED_KEY, slowest_part_ts))

    # Another consumer already handled the tick if the first LAST_TRIGGERED
    # timestamp we got is different from the one we just got from the GETSET.
    # Nothing needs to be done
    if precheck_last_ts != last_ts:
        return

    # Track the delay from the true time, ideally this should be pretty
    # close, but in the case of a backlog, this will be much higher
    total_delay = datetime.now().timestamp() - slowest_part_ts

    # Keep tick datetime objects timezone aware
    tick = datetime.fromtimestamp(slowest_part_ts, tz=timezone.utc)

    logger.info("monitors.consumer.clock_tick", extra={"reference_datetime": str(tick)})
    metrics.gauge("monitors.task.clock_delay", total_delay, sample_rate=1.0)

    # If more than exactly a minute has passed then we've skipped a
    # task run, backfill those ticks. This can happen when one partition has
    # slowed down too much and is missing a minutes worth of check-ins
    if last_ts is not None and slowest_part_ts > last_ts + 60:
        # We only want to do backfills when we're using the clock tick
        # consumer, otherwise the celery tasks may process out of order
        backfill_tick = datetime.fromtimestamp(last_ts + 60, tz=timezone.utc)
        while backfill_tick < tick:
            extra = {"reference_datetime": str(backfill_tick)}
            logger.info("monitors.consumer.clock_tick_backfill", extra=extra)

            _dispatch_tick(backfill_tick)
            backfill_tick = backfill_tick + timedelta(minutes=1)

    _dispatch_tick(tick)
