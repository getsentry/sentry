from __future__ import annotations

import logging
from datetime import datetime

from arroyo.backends.kafka import KafkaPayload
from django.db.models import Q
from sentry_kafka_schemas.schema_types.monitors_clock_tasks_v1 import MarkMissing

from sentry.constants import ObjectStatus
from sentry.monitors.logic.mark_failed import mark_failed
from sentry.monitors.models import (
    CheckInStatus,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorStatus,
    MonitorType,
)
from sentry.monitors.schedule import get_prev_schedule
from sentry.monitors.types import TickVolumeAnomolyResult
from sentry.utils import metrics

from .producer import MONITORS_CLOCK_TASKS_CODEC, produce_task

logger = logging.getLogger(__name__)


# This is the MAXIMUM number of MONITOR this job will check.
#
# NOTE: We should keep an eye on this as we have more and more usage of
# monitors the larger the number of checkins to check will exist.
MONITOR_LIMIT = 10_000

# re-use the monitor exclusion query node across dispatch_check_missing and
# mark_environment_missing.
IGNORE_MONITORS = ~Q(
    status__in=[
        MonitorStatus.DISABLED,
        MonitorStatus.PENDING_DELETION,
        MonitorStatus.DELETION_IN_PROGRESS,
    ]
) & ~Q(
    monitor__status__in=[
        ObjectStatus.DISABLED,
        ObjectStatus.PENDING_DELETION,
        ObjectStatus.DELETION_IN_PROGRESS,
    ]
)


def dispatch_check_missing(ts: datetime, volume_anomaly_result: TickVolumeAnomolyResult):
    """
    Given a clock tick timestamp determine which monitor environments are past
    their next_checkin_latest, indicating they haven't checked-in when they
    should have

    When the volume_anomaly_result is "abnormal" miss check-ins will be created
    with the unknown status and will not mark the monitor as failed or produce
    notifications.

    This will dispatch MarkMissing messages into monitors-clock-tasks.
    """
    missed_envs = list(
        MonitorEnvironment.objects.filter(
            IGNORE_MONITORS,
            monitor__type__in=[MonitorType.CRON_JOB],
            next_checkin_latest__lte=ts,
        ).values("id")[:MONITOR_LIMIT]
    )

    metrics.gauge(
        "sentry.monitors.tasks.check_missing.count",
        len(missed_envs),
        sample_rate=1.0,
    )

    for monitor_environment in missed_envs:
        message: MarkMissing = {
            "type": "mark_missing",
            "ts": ts.timestamp(),
            "monitor_environment_id": monitor_environment["id"],
            "volume_anomaly_result": volume_anomaly_result.value,
        }
        # XXX(epurkhiser): Partitioning by monitor_environment.id is important
        # here as these task messages will be consumed in a multi-consumer
        # setup. If we backlogged clock-ticks we may produce multiple missed
        # tasks for the same monitor_environment. These MUST happen in-order.
        payload = KafkaPayload(
            str(monitor_environment["id"]).encode(),
            MONITORS_CLOCK_TASKS_CODEC.encode(message),
            [],
        )
        produce_task(payload)


def mark_environment_missing(monitor_environment_id: int, ts: datetime):
    logger.info("mark_missing", extra={"monitor_environment_id": monitor_environment_id})

    try:
        monitor_environment = MonitorEnvironment.objects.select_related("monitor").get(
            IGNORE_MONITORS,
            id=monitor_environment_id,
            # XXX(epurkhiser): Ensure a previous dispatch_check_missing task did
            # not already move the next_checkin_latest forward. This can happen
            # when the clock-ticks happen rapidly and we fire off
            # dispatch_check_missing rapidly (due to a backlog in the
            # ingest-monitors topic)
            next_checkin_latest__lte=ts,
        )
    except MonitorEnvironment.DoesNotExist:
        # Nothing to do. We already handled this miss in an earlier tasks
        # (or the environment was deleted)
        return

    monitor = monitor_environment.monitor
    # next_checkin must be set, since detecting this monitor as missed means
    # there must have been an initial user check-in.
    assert monitor_environment.next_checkin is not None
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

    mark_failed(checkin, failed_at=most_recent_expected_ts)
