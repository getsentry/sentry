from __future__ import annotations

import logging
from datetime import datetime

from sentry.monitors.logic.mark_failed import mark_failed
from sentry.monitors.models import CheckInStatus, MonitorCheckIn
from sentry.monitors.schedule import get_prev_schedule
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics

logger = logging.getLogger("sentry")

# This is the MAXIMUM number of pending MONITOR CHECKINS this job will check.
#
# NOTE: We should keep an eye on this as we have more and more usage of
# monitors the larger the number of checkins to check will exist.
CHECKINS_LIMIT = 10_000


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
