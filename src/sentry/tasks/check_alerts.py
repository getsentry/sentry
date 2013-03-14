"""
sentry.tasks.check_alerts
~~~~~~~~~~~~~~~~~~~~~~~~~

- Store a sorted set per project
- Each sorted set contains the number of events seen in the interval (1 minute)
  - An additional set contains the number of unique events seen
- Every minute we iterate this sorted set (we can exploit the queue just like buffers to avoid crons)
  - We clear the results immediately to no-op any concurrent tasks that might try to run
  - The task fires off a set of subtasks that individually check each project
    - Each project's value is compared to the historic value in the last N minutes (15m for redis counters or
      a period of time using the SQL counters)
    - We only alert if an alert has not been seen on this condition in the last N minutes

Notes:

- Nydus optimizes out multiple writes/gets, so its not as expensive as it looks
- If there are not enough data points in history, alerts are never sent (as they could be false positives)

Last Notified will be tracked by using a new Alert model, which has the following properties:

- users alerted
- datetime
- type
- ident

Type and ident would be similar to how Activity works.

Alert expiration threshold MUST be > MINUTE_NORMALIZATION.

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import division

from datetime import timedelta
from celery.task import periodic_task, task
from celery.task.schedules import crontab
from django.utils import timezone
from sentry.constants import MINUTE_NORMALIZATION
from sentry.utils import math


def fsteps(start, stop, steps):
    step = (stop - start) / steps
    while start <= stop:
        yield start
        start += step


@periodic_task(ignore_result=True, run_every=crontab(minute='*'))
def check_alerts(**kwargs):
    """
    Iterates all current keys and fires additional tasks to check each individual
    project's alert settings.
    """
    from sentry.models import ProjectCountByMinute
    from sentry.utils.queue import maybe_delay

    now = timezone.now()
    # we want at least a 60 second window of events
    max_date = now - timedelta(minutes=1)
    min_date = max_date - timedelta(minutes=MINUTE_NORMALIZATION)

    # find each project which has data for the last interval
    # TODO: we could force more work on the db by eliminating onces which don't have the full aggregate we need
    qs = ProjectCountByMinute.objects.filter(
        date__lte=max_date,
        date__gt=min_date,
        times_seen__gt=0,
    ).values_list('project_id', 'date', 'times_seen')
    for project_id, date, count in qs:
        normalized_count = int(count / ((now - date).seconds / 60))
        maybe_delay(check_project_alerts,
            project_id=project_id,
            when=max_date,
            count=normalized_count,
            expires=120,
        )


@task(ignore_result=True)
def check_project_alerts(project_id, when, count, **kwargs):
    """
    Given 'when' and 'count', which should signify recent times we compare it to historical data for this project
    and if over a given threshold, create an alert.
    """
    from sentry.conf import settings
    from sentry.models import ProjectCountByMinute, ProjectOption, Alert

    try:
        threshold, min_events = ProjectOption.objects.get(project=project_id, key='project_alert_pct')
    except ProjectOption.DoesNotExist:
        threshold, min_events = settings.DEFAULT_ALERT_PROJECT_THRESHOLD

    if not threshold and min_events:
        return

    if min_events > count:
        return

    # number of 15 minute intervals to capture
    intervals = 8

    max_date = when - timedelta(minutes=MINUTE_NORMALIZATION)
    min_date = max_date - timedelta(minutes=(intervals * MINUTE_NORMALIZATION))

    # get historical data
    data = list(ProjectCountByMinute.objects.filter(
        project=project_id,
        date__lte=max_date,
        date__gt=min_date,
    ).values_list('times_seen', flat=True))

    # Bail if we don't have enough data points
    if len(data) != intervals:
        return

    mean = math.mean(data)
    dev = math.mad(data)
    previous = (mean + dev * 2) / MINUTE_NORMALIZATION

    pct_increase = count / previous * 100
    if pct_increase > threshold:
        Alert.maybe_alert(
            project_id=project_id,
            message='Rate of events per minute increased from %d to %d (+%d%%)' % (previous, count, pct_increase),
        )
