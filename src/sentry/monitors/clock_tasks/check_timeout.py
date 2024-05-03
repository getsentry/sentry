from __future__ import annotations

import logging
from datetime import datetime

from arroyo.backends.kafka import KafkaPayload
from sentry_kafka_schemas.schema_types.monitors_clock_tasks_v1 import MarkTimeout

from sentry.monitors.logic.mark_failed import mark_failed
from sentry.monitors.models import CheckInStatus, MonitorCheckIn
from sentry.monitors.schedule import get_prev_schedule
from sentry.utils import metrics

from .producer import MONITORS_CLOCK_TASKS_CODEC, produce_task

logger = logging.getLogger(__name__)

# This is the MAXIMUM number of pending MONITOR CHECKINS this job will check.
#
# NOTE: We should keep an eye on this as we have more and more usage of
# monitors the larger the number of checkins to check will exist.
CHECKINS_LIMIT = 10_000


def dispatch_check_timeout(ts: datetime):
    """
    Given a clock tick timestamp determine which check-ins are past their
    timeout_at.

    This will dispatch MarkTimeout messages into monitors-clock-tasks.
    """
    qs = MonitorCheckIn.objects.filter(status=CheckInStatus.IN_PROGRESS, timeout_at__lte=ts)[
        :CHECKINS_LIMIT
    ]
    metrics.gauge("sentry.monitors.tasks.check_timeout.count", qs.count(), sample_rate=0)
    # check for any monitors which are still running and have exceeded their maximum runtime
    for checkin in qs:
        message: MarkTimeout = {
            "type": "mark_timeout",
            "ts": ts.timestamp(),
            "monitor_environment_id": checkin.monitor_environment_id,
            "checkin_id": checkin.id,
        }
        # XXX(epurkhiser): Partitioning by monitor_environment.id is important
        # here as these task messages will be consumed in a multi-consumer
        # setup. If we backlogged clock-ticks we may produce multiple timeout
        # tasks for the same monitor_environment. These MUST happen in-order.
        payload = KafkaPayload(
            str(checkin.monitor_environment_id).encode(),
            MONITORS_CLOCK_TASKS_CODEC.encode(message),
            [],
        )
        produce_task(payload)


def mark_checkin_timeout(checkin_id: int, ts: datetime):
    logger.info("checkin_timeout", extra={"checkin_id": checkin_id})

    checkin = (
        MonitorCheckIn.objects.select_related("monitor_environment")
        .select_related("monitor_environment__monitor")
        .get(id=checkin_id)
    )

    monitor_environment = checkin.monitor_environment
    monitor = monitor_environment.monitor

    affected = (
        MonitorCheckIn.objects.filter(id=checkin_id)
        .exclude(status=CheckInStatus.TIMEOUT)
        .update(status=CheckInStatus.TIMEOUT)
    )
    if not affected:
        return

    # we only mark the monitor as failed if a newer checkin wasn't responsible
    # for the state change
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
