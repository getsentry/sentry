from __future__ import absolute_import, print_function

import logging

from django.utils import timezone

from sentry.models import Monitor, MonitorStatus, MonitorType
from sentry.tasks.base import instrumented_task


logger = logging.getLogger('sentry')


@instrumented_task(name='sentry.tasks.check_monitors', time_limit=15, soft_time_limit=10)
def check_monitors():
    qs = Monitor.objects.filter(
        type__in=[MonitorType.HEARTBEAT, MonitorType.CRON_JOB],
        next_checkin__lt=timezone.now(),
    ).exclude(
        status=MonitorStatus.DISABLED,
    )
    for monitor in qs:
        logger.info('monitor.missed-checkin', extra={
            'monitor_id': monitor.id,
        })
        monitor.mark_failed()
