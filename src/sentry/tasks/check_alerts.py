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

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import division

import time
from datetime import datetime, timedelta
from celery.task import periodic_task, task
from celery.task.schedules import crontab
from django.conf import settings as dj_settings
from django.utils import timezone


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
    from sentry import app
    from sentry.utils.queue import maybe_delay

    timestamp = time.time() - 60
    when = datetime.fromtimestamp(timestamp)
    if dj_settings.USE_TZ:
        when = when.replace(tzinfo=timezone.utc)

    results = app.counter.extract_counts(prefix='project', when=timestamp)['results']
    for project_id, count in results:
        maybe_delay(check_project_alerts,
            project_id=int(project_id),
            when=when,
            count=int(count),
            expires=120,
        )


@task(ignore_result=True)
def check_project_alerts(project_id, when, count, **kwargs):
    """
    Given 'when' and 'count', which should signify recent times we compare it to historical data for this project
    and if over a given threshold, create an alert.
    """
    from sentry.constants import MINUTE_NORMALIZATION
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
    intervals = 4

    min_date = when
    max_date = when - timedelta(minutes=(intervals * MINUTE_NORMALIZATION))

    # get historical data
    data = list(ProjectCountByMinute.objects.filter(
        project=project_id,
        date__lt=min_date,
        date__gte=max_date,
    ).values_list('times_seen', flat=True))

    # Bail if we dont have enough data points
    if len(data) != intervals:
        return

    previous = sum(data) / intervals / MINUTE_NORMALIZATION

    if count / previous * 100 > threshold:
        Alert.maybe_alert(
            project_id=project_id,
            message='Rate of events per minute increased from %d to %d' % (previous, count),
        )
