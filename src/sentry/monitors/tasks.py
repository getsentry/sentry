from __future__ import annotations

import logging
from datetime import datetime, timezone
from functools import lru_cache
from typing import Mapping

import msgpack
import sentry_sdk
from arroyo import Partition, Topic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from confluent_kafka.admin import AdminClient, PartitionMetadata
from django.conf import settings

from sentry.constants import ObjectStatus
from sentry.monitors.logic.mark_failed import mark_failed
from sentry.monitors.schedule import get_prev_schedule
from sentry.monitors.types import ClockPulseMessage
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics, redis
from sentry.utils.arroyo_producer import SingletonProducer
from sentry.utils.kafka_config import (
    get_kafka_admin_cluster_options,
    get_kafka_producer_cluster_options,
    get_topic_definition,
)

from .models import CheckInStatus, MonitorCheckIn, MonitorEnvironment, MonitorStatus, MonitorType

logger = logging.getLogger("sentry")

# This is the MAXIMUM number of MONITOR this job will check.
#
# NOTE: We should keep an eye on this as we have more and more usage of
# monitors the larger the number of checkins to check will exist.
MONITOR_LIMIT = 10_000

# This is the MAXIMUM number of pending MONITOR CHECKINS this job will check.
#
# NOTE: We should keep an eye on this as we have more and more usage of
# monitors the larger the number of checkins to check will exist.
CHECKINS_LIMIT = 10_000

# This key is used to store the last timestamp that the tasks were triggered.
MONITOR_TASKS_LAST_TRIGGERED_KEY = "sentry.monitors.last_tasks_ts"

# This key is used to store the hashmap of Mapping[PartitionKey, Timestamp]
MONITOR_TASKS_PARTITION_CLOCKS = "sentry.monitors.partition_clocks"


def _get_producer() -> KafkaProducer:
    cluster_name = get_topic_definition(settings.KAFKA_INGEST_MONITORS)["cluster"]
    producer_config = get_kafka_producer_cluster_options(cluster_name)
    producer_config.pop("compression.type", None)
    producer_config.pop("message.max.bytes", None)
    return KafkaProducer(build_kafka_configuration(default_config=producer_config))


_checkin_producer = SingletonProducer(_get_producer)


@lru_cache(maxsize=None)
def _get_partitions() -> Mapping[int, PartitionMetadata]:
    topic = settings.KAFKA_INGEST_MONITORS
    cluster_name = get_topic_definition(topic)["cluster"]

    conf = get_kafka_admin_cluster_options(cluster_name)
    admin_client = AdminClient(conf)
    result = admin_client.list_topics(topic)
    topic_metadata = result.topics.get(topic)

    assert topic_metadata
    return topic_metadata.partitions


def _dispatch_tasks(ts: datetime):
    """
    Dispatch monitor tasks triggered by the consumer clock.

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
    check_missing.delay(current_datetime=ts)
    check_timeout.delay(current_datetime=ts)


def try_monitor_tasks_trigger(ts: datetime, partition: int):
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
    reference_datetime = ts.replace(second=0, microsecond=0)
    reference_ts = int(reference_datetime.timestamp())

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

    precheck_last_ts = redis_client.get(MONITOR_TASKS_LAST_TRIGGERED_KEY)
    if precheck_last_ts is not None:
        precheck_last_ts = int(precheck_last_ts)

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
    last_ts = redis_client.getset(MONITOR_TASKS_LAST_TRIGGERED_KEY, slowest_part_ts)
    if last_ts is not None:
        last_ts = int(last_ts)

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
    # task run, report that to sentry, it is a problem.
    if last_ts is not None and slowest_part_ts > last_ts + 60:
        with sentry_sdk.push_scope() as scope:
            scope.set_extra("last_ts", last_ts)
            scope.set_extra("slowest_part_ts", slowest_part_ts)
            sentry_sdk.capture_message("Monitor task dispatch minute skipped")

    _dispatch_tasks(tick)


@instrumented_task(name="sentry.monitors.tasks.clock_pulse", silo_mode=SiloMode.REGION)
def clock_pulse(current_datetime=None):
    """
    This task is run once a minute when to produce 'clock pulses' into the
    monitor ingest topic. This is to ensure there is always a message in the
    topic that can drive all partition clocks, which dispatch monitor tasks.
    """
    if current_datetime is None:
        current_datetime = datetime.now(tz=timezone.utc)

    if settings.SENTRY_EVENTSTREAM != "sentry.eventstream.kafka.KafkaEventStream":
        # Directly trigger try_monitor_tasks_trigger in dev
        for partition in _get_partitions().values():
            try_monitor_tasks_trigger(current_datetime, partition.id)
        return

    message: ClockPulseMessage = {
        "message_type": "clock_pulse",
    }

    payload = KafkaPayload(None, msgpack.packb(message), [])

    # We create a clock-pulse (heart-beat) for EACH available partition in the
    # topic. This is a requirement to ensure that none of the partitions stall,
    # since the global clock is tied to the slowest partition.
    for partition in _get_partitions().values():
        dest = Partition(Topic(settings.KAFKA_INGEST_MONITORS), partition.id)
        _checkin_producer.produce(dest, payload)


@instrumented_task(
    name="sentry.monitors.tasks.check_missing",
    time_limit=15,
    soft_time_limit=10,
    silo_mode=SiloMode.REGION,
)
def check_missing(current_datetime: datetime):
    # [!!]: We want our reference time to be clamped to the very start of the
    # minute, otherwise we may mark checkins as missed if they didn't happen
    # immediately before this task was run (usually a few seconds into the minute)
    #
    # XXX(epurkhiser): This *should* have already been handle by the
    # try_monitor_tasks_trigger, since it clamps the reference timestamp, but I
    # am leaving this here to be safe
    current_datetime = current_datetime.replace(second=0, microsecond=0)

    qs = (
        # Monitors that have reached the latest checkin time
        MonitorEnvironment.objects.filter(
            monitor__type__in=[MonitorType.CRON_JOB],
            next_checkin_latest__lte=current_datetime,
        )
        .exclude(
            status__in=[
                MonitorStatus.DISABLED,
                MonitorStatus.PENDING_DELETION,
                MonitorStatus.DELETION_IN_PROGRESS,
            ]
        )
        .exclude(
            monitor__status__in=[
                ObjectStatus.DISABLED,
                ObjectStatus.PENDING_DELETION,
                ObjectStatus.DELETION_IN_PROGRESS,
            ],
        )
        .exclude(
            monitor__is_muted=True,  # Temporary fix until we can move out of celery or reduce load
        )
        .exclude(
            is_muted=True,  # Temporary fix until we can move out of celery or reduce load
        )[:MONITOR_LIMIT]
    )

    metrics.gauge("sentry.monitors.tasks.check_missing.count", qs.count(), sample_rate=1.0)
    for monitor_environment in qs:
        mark_environment_missing.delay(monitor_environment.id, current_datetime)


@instrumented_task(
    name="sentry.monitors.tasks.mark_environment_missing",
    max_retries=0,
    record_timing=True,
)
def mark_environment_missing(monitor_environment_id: int, ts: datetime):
    logger.info("monitor.missed-checkin", extra={"monitor_environment_id": monitor_environment_id})

    monitor_environment = MonitorEnvironment.objects.select_related("monitor").get(
        id=monitor_environment_id
    )
    monitor = monitor_environment.monitor
    expected_time = monitor_environment.next_checkin

    # add missed checkin.
    #
    # XXX(epurkhiser): The date_added is backdated so that this missed
    # check-in correctly reflects the time of when the checkin SHOULD
    # have happened. It is the same as the expected_time.
    checkin = MonitorCheckIn.objects.create(
        project_id=monitor_environment.monitor.project_id,
        monitor=monitor_environment.monitor,
        monitor_environment=monitor_environment,
        status=CheckInStatus.MISSED,
        date_added=expected_time,
        expected_time=expected_time,
        monitor_config=monitor.get_validated_config(),
    )

    # Compute when the check-in *should* have happened given the current
    # reference timestamp. This is different from the expected_time usage above
    # as it is computing that most recent expected check-in time using our
    # reference time. `expected_time` is when the check-in was expected to
    # happen. This takes advantage of the fact that the current reference time
    # will always be at least a minute after the last expected check-in.
    #
    # Typically `expected_time` and this calculated time should be the same, but
    # there are cases where it may not be:
    #
    #  1. We are guarding against a task having not run for every minute.
    #     If we simply set our mark_failed reference timestamp to the failing
    #     check-ins date_added the `next_checkin` computed in mark_failed may
    #     fall behind if the clock skips, since it will just keep computing
    #     next_checkins from previous check-ins.
    #
    #  2. We are more "correctly" handling checkin_margins that are larger
    #     than the schedule gaps. We want the timeout to be placed when it was
    #     expected, but calculate the next expected check-in from the true
    #     previous expected check-in (which would be some time during the
    #     overlapping margin.)

    # We use the expected_time of the check-in to compute out the schedule.
    # Specifically important for interval where it's a function of some
    # starting time.
    #
    # When computing our timestamps MUST be in the correct timezone of the
    # monitor to compute the previous schedule
    most_recent_expected_ts = get_prev_schedule(
        expected_time.astimezone(monitor.timezone),
        ts.astimezone(monitor.timezone),
        monitor.schedule,
    )

    mark_failed(checkin, ts=most_recent_expected_ts)


@instrumented_task(
    name="sentry.monitors.tasks.check_timeout",
    time_limit=15,
    soft_time_limit=10,
    silo_mode=SiloMode.REGION,
)
def check_timeout(current_datetime: datetime):
    current_datetime = current_datetime.replace(second=0, microsecond=0)

    qs = MonitorCheckIn.objects.filter(
        status=CheckInStatus.IN_PROGRESS, timeout_at__lte=current_datetime
    )[:CHECKINS_LIMIT]
    metrics.gauge("sentry.monitors.tasks.check_timeout.count", qs.count(), sample_rate=1)
    # check for any monitors which are still running and have exceeded their maximum runtime
    for checkin in qs:
        mark_checkin_timeout.delay(checkin.id, current_datetime)


@instrumented_task(
    name="sentry.monitors.tasks.mark_checkin_timeout",
    max_retries=0,
    record_timing=True,
)
def mark_checkin_timeout(checkin_id: int, ts: datetime, **kwargs):
    logger.info("checkin.timeout", extra={"checkin_id": checkin_id})

    checkin = (
        MonitorCheckIn.objects.select_related("monitor_environment")
        .select_related("monitor_environment__monitor")
        .get(id=checkin_id)
    )

    monitor_environment = checkin.monitor_environment
    monitor = monitor_environment.monitor

    logger.info(
        "monitor_environment.checkin-timeout",
        extra={"monitor_environment_id": monitor_environment.id, "checkin_id": checkin.id},
    )
    affected = checkin.update(status=CheckInStatus.TIMEOUT)
    if not affected:
        return

    # we only mark the monitor as failed if a newer checkin wasn't responsible for the state
    # change
    has_newer_result = MonitorCheckIn.objects.filter(
        monitor_environment=monitor_environment,
        date_added__gt=checkin.date_added,
        status__in=[CheckInStatus.OK, CheckInStatus.ERROR],
    ).exists()
    if not has_newer_result:
        # Similar to mark_missed we compute when the most recent check-in should
        # have happened to use as our reference time for mark_failed.
        #
        # XXX(epurkhiser): For ScheduleType.INTERVAL this MAY compute an
        # incorrect next_checkin from what the actual user task might expect,
        # since we don't know the behavior of the users task scheduling in the
        # scenario that it 1) doesn't complete, or 2) runs for longer than
        # their configured time-out time.
        #
        # See `test_timeout_using_interval`
        most_recent_expected_ts = get_prev_schedule(
            checkin.date_added.astimezone(monitor.timezone),
            ts.astimezone(monitor.timezone),
            monitor.schedule,
        )

        mark_failed(checkin, ts=most_recent_expected_ts)
