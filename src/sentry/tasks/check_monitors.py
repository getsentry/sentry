from __future__ import absolute_import, print_function

import logging

from datetime import timedelta
from django.utils import timezone

from sentry.models import CheckInStatus, Monitor, MonitorCheckIn, MonitorStatus, MonitorType
from sentry.tasks.base import instrumented_task


logger = logging.getLogger('sentry')

TIMEOUT = timedelta(hours=12)


@instrumented_task(name='sentry.tasks.check_monitors', time_limit=15, soft_time_limit=10)
def check_monitors(current_datetime=None):
    if current_datetime is None:
        current_datetime = timezone.now()

    qs = Monitor.objects.filter(
        type__in=[MonitorType.HEARTBEAT, MonitorType.CRON_JOB],
        next_checkin__lt=current_datetime,
    ).exclude(
        status=MonitorStatus.DISABLED,
    )[:10000]
    for monitor in qs:
        logger.info('monitor.missed-checkin', extra={
            'monitor_id': monitor.id,
        })
        monitor.mark_failed()

    # timeout any monitors still marked as in progress after X time
    qs = MonitorCheckIn.objects.filter(
        status=CheckInStatus.IN_PROGRESS,
        date_updated__lt=current_datetime - TIMEOUT,
    ).select_related('monitor')[:10000]
    for checkin in qs:
        monitor = checkin.monitor
        logger.info('monitor.checkin-timeout', extra={
            'monitor_id': monitor.id,
            'checkin_id': checkin.id,
        })
        affected = MonitorCheckIn.objects.filter(
            id=checkin.id,
            status=CheckInStatus.IN_PROGRESS,
        ).update(status=CheckInStatus.ERROR)
        if not affected:
            continue

        # we only mark the monitor as failed if a newer checkin wasn't responsible for the state
        # change
        has_newer_result = MonitorCheckIn.objects.filter(
            monitor=monitor.id,
            date_added__gt=checkin.date_added,
            status__in=[CheckInStatus.OK, CheckInStatus.ERROR]
        ).exists()
        if not has_newer_result:
            monitor.mark_failed()
