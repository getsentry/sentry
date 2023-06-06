import logging
from datetime import timedelta

from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics

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
TIMEOUT = 30

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


@instrumented_task(name="sentry.monitors.tasks.check_monitors", time_limit=15, soft_time_limit=10)
def check_monitors(current_datetime=None):
    if current_datetime is None:
        current_datetime = timezone.now()

    # [!!]: We want our reference time to be clamped to the very start of the
    # minute, otherwise we may mark checkins as missed if they didn't happen
    # immediately before this task was run (usually a few seconds into the minute)
    #
    # Because we query `next_checkin__lt=current_datetime` clamping to the
    # minute will ignore monitors that haven't had their checkin yet within
    # this minute.
    current_datetime = current_datetime.replace(second=0, microsecond=0)

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
                ObjectStatus.DISABLED,
                ObjectStatus.PENDING_DELETION,
                ObjectStatus.DELETION_IN_PROGRESS,
            ]
        )[:MONITOR_LIMIT]
    )
    metrics.gauge("sentry.monitors.tasks.check_monitors.missing_count", qs.count())
    for monitor_environment in qs:
        try:
            logger.info(
                "monitor.missed-checkin", extra={"monitor_environment_id": monitor_environment.id}
            )

            monitor = monitor_environment.monitor
            expected_time = None
            if monitor_environment.last_checkin:
                expected_time = monitor.get_next_scheduled_checkin_without_margin(
                    monitor_environment.last_checkin
                )

            # add missed checkin
            checkin = MonitorCheckIn.objects.create(
                project_id=monitor_environment.monitor.project_id,
                monitor=monitor_environment.monitor,
                monitor_environment=monitor_environment,
                status=CheckInStatus.MISSED,
                expected_time=expected_time,
                monitor_config=monitor.get_validated_config(),
            )
            monitor_environment.mark_failed(reason=MonitorFailure.MISSED_CHECKIN)
        except Exception:
            logger.exception("Exception in check_monitors - mark missed")

    qs = MonitorCheckIn.objects.filter(status=CheckInStatus.IN_PROGRESS).select_related(
        "monitor", "monitor_environment"
    )[:CHECKINS_LIMIT]
    metrics.gauge("sentry.monitors.tasks.check_monitors.timeout_count", qs.count())
    # check for any monitors which are still running and have exceeded their maximum runtime
    for checkin in qs:
        try:
            timeout = timedelta(
                minutes=(checkin.monitor.config or {}).get("max_runtime") or TIMEOUT
            )
            # Check against date_updated to allow monitors to run for longer as
            # long as they continute to send heart beats updating the checkin
            if checkin.date_updated > current_datetime - timeout:
                continue

            monitor_environment = checkin.monitor_environment
            logger.info(
                "monitor_environment.checkin-timeout",
                extra={"monitor_environment_id": monitor_environment.id, "checkin_id": checkin.id},
            )
            affected = MonitorCheckIn.objects.filter(
                id=checkin.id, status=CheckInStatus.IN_PROGRESS
            ).update(status=CheckInStatus.TIMEOUT)
            if not affected:
                continue

            # we only mark the monitor as failed if a newer checkin wasn't responsible for the state
            # change
            has_newer_result = MonitorCheckIn.objects.filter(
                monitor_environment=monitor_environment,
                date_added__gt=checkin.date_added,
                status__in=[CheckInStatus.OK, CheckInStatus.ERROR],
            ).exists()
            if not has_newer_result:
                monitor_environment.mark_failed(reason=MonitorFailure.DURATION)
        except Exception:
            logger.exception("Exception in check_monitors - mark timeout")
