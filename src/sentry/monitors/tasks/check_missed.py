from __future__ import annotations

import logging
from datetime import datetime

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
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics

logger = logging.getLogger("sentry")


# This is the MAXIMUM number of MONITOR this job will check.
#
# NOTE: We should keep an eye on this as we have more and more usage of
# monitors the larger the number of checkins to check will exist.
MONITOR_LIMIT = 10_000


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
