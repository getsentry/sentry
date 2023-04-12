import logging
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from sentry.tasks.base import instrumented_task
from sentry.utils import metrics

from ..utils.query import RangeQuerySetWrapper
from .models import (
    CheckInStatus,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorFailure,
    MonitorStatus,
    MonitorType,
)

logger = logging.getLogger("sentry")

# default maximum runtime for a monitor, in minutes
TIMEOUT = 12 * 60

# This is the MAXIMUM number of MONITOR this job will check.
#
# NOTE: We should keep an eye on this as we have more and more usage of
# monitors the larger the number of checkins to check will exist.
MONITOR_LIMIT = 20_000

# This is the MAXIMUM number of pending MONITOR CHECKINS this job will check.
#
# NOTE: We should keep an eye on this as we have more and more usage of
# monitors the larger the number of checkins to check will exist.
CHECKINS_LIMIT = 20_000


@instrumented_task(name="sentry.monitors.tasks.check_monitors", time_limit=25, soft_time_limit=20)
def check_monitors(current_datetime=None):
    if current_datetime is None:
        current_datetime = timezone.now()

    qs = (
        MonitorEnvironment.objects.filter(
            monitor__type__in=[MonitorType.CRON_JOB], next_checkin__lt=current_datetime
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
                MonitorStatus.DISABLED,
                MonitorStatus.PENDING_DELETION,
                MonitorStatus.DELETION_IN_PROGRESS,
            ]
        )[:MONITOR_LIMIT]
    )
    metrics.gauge("sentry.monitors.tasks.check_monitors.missing_count", qs.count())
    for monitor_environment in RangeQuerySetWrapper(qs):
        logger.info(
            "monitor.missed-checkin", extra={"monitor_environment_id": monitor_environment.id}
        )
        # add missed checkin
        checkin = MonitorCheckIn.objects.create(
            project_id=monitor_environment.monitor.project_id,
            monitor=monitor_environment.monitor,
            monitor_environment=monitor_environment,
            status=CheckInStatus.MISSED,
        )
        monitor_environment.monitor.mark_failed(reason=MonitorFailure.MISSED_CHECKIN)
        monitor_environment.mark_failed(reason=MonitorFailure.MISSED_CHECKIN)

    qs = (
        MonitorCheckIn.objects.filter(status=CheckInStatus.IN_PROGRESS)
        .select_related("monitor")
        .exclude(monitor_id__in=settings.SENTRY_MONITORS_IGNORED_MONITORS)[:CHECKINS_LIMIT]
    )
    metrics.gauge("sentry.monitors.tasks.check_monitors.timeout_count", qs.count())
    # check for any monitors which are still running and have exceeded their maximum runtime
    for checkin in RangeQuerySetWrapper(qs):
        timeout = timedelta(minutes=(checkin.monitor.config or {}).get("max_runtime") or TIMEOUT)
        if checkin.date_updated > current_datetime - timeout:
            continue

        monitor_environment = checkin.monitor_environment
        logger.info(
            "monitor_environment.checkin-timeout",
            extra={"monitor_environment_id": monitor_environment.id, "checkin_id": checkin.id},
        )
        affected = MonitorCheckIn.objects.filter(
            id=checkin.id, status=CheckInStatus.IN_PROGRESS
        ).update(status=CheckInStatus.ERROR)
        if not affected:
            continue

        # we only mark the monitor as failed if a newer checkin wasn't responsible for the state
        # change
        has_newer_result = MonitorCheckIn.objects.filter(
            monitor=monitor_environment.id,
            date_added__gt=checkin.date_added,
            status__in=[CheckInStatus.OK, CheckInStatus.ERROR],
        ).exists()
        if not has_newer_result:
            monitor_environment.monitor.mark_failed(reason=MonitorFailure.DURATION)
            monitor_environment.mark_failed(reason=MonitorFailure.DURATION)
