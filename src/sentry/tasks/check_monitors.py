from __future__ import absolute_import, print_function

import logging

from datetime import timedelta
from django.utils import timezone

from sentry.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorFailure,
    MonitorStatus,
    MonitorType,
)
from sentry.tasks.base import instrumented_task


logger = logging.getLogger("sentry")

# default maximum runtime for a monitor, in minutes
TIMEOUT = 12 * 60


@instrumented_task(name="sentry.tasks.check_monitors", time_limit=15, soft_time_limit=10)
def check_monitors(current_datetime=None):
    if current_datetime is None:
        current_datetime = timezone.now()

    qs = Monitor.objects.filter(
        type__in=[MonitorType.HEARTBEAT, MonitorType.CRON_JOB], next_checkin__lt=current_datetime
    ).exclude(
        status__in=[
            MonitorStatus.DISABLED,
            MonitorStatus.PENDING_DELETION,
            MonitorStatus.DELETION_IN_PROGRESS,
        ]
    )[
        :10000
    ]
    for monitor in qs:
        logger.info("monitor.missed-checkin", extra={"monitor_id": monitor.id})
        monitor.mark_failed(reason=MonitorFailure.MISSED_CHECKIN)

    qs = MonitorCheckIn.objects.filter(status=CheckInStatus.IN_PROGRESS).select_related("monitor")[
        :10000
    ]
    # check for any monitors which are still running and have exceeded their maximum runtime
    for checkin in qs:
        timeout = timedelta(minutes=(checkin.monitor.config or {}).get("max_runtime") or TIMEOUT)
        if checkin.date_updated > current_datetime - timeout:
            continue

        monitor = checkin.monitor
        logger.info(
            "monitor.checkin-timeout", extra={"monitor_id": monitor.id, "checkin_id": checkin.id}
        )
        affected = MonitorCheckIn.objects.filter(
            id=checkin.id, status=CheckInStatus.IN_PROGRESS
        ).update(status=CheckInStatus.ERROR)
        if not affected:
            continue

        # we only mark the monitor as failed if a newer checkin wasn't responsible for the state
        # change
        has_newer_result = MonitorCheckIn.objects.filter(
            monitor=monitor.id,
            date_added__gt=checkin.date_added,
            status__in=[CheckInStatus.OK, CheckInStatus.ERROR],
        ).exists()
        if not has_newer_result:
            monitor.mark_failed(reason=MonitorFailure.DURATION)
