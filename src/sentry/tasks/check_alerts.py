"""
sentry.tasks.check_alerts
~~~~~~~~~~~~~~~~~~~~~~~~~

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


@periodic_task(
    name='sentry.tasks.check_alerts',
    run_every=crontab(minute='*'), queue='alerts')
def check_alerts(**kwargs):
    """
    Iterates all current keys and fires additional tasks to check each individual
    project's alert settings.
    """
    from sentry.models import ProjectCountByMinute

    now = timezone.now()
    # we want at least a 60 second window of events
    max_date = now - timedelta(minutes=1)
    min_date = max_date - timedelta(minutes=MINUTE_NORMALIZATION)

    # find each project which has data for the last interval
    # TODO: we could force more work on the db by eliminating onces which don't have the full aggregate we need
    qs = ProjectCountByMinute.objects.filter(
        date__lte=max_date,
        date__gt=min_date,
    ).values_list('project_id', 'date', 'times_seen')
    for project_id, date, count in qs:
        if not count:
            continue  # shouldnt happen
        normalized_count = int(count / ((now - date).seconds / 60))
        check_project_alerts.delay(
            project_id=project_id,
            when=max_date,
            count=normalized_count,
            expires=120,
        )


@task(name='sentry.tasks.check_alerts.check_project_alerts', queue='alerts')
def check_project_alerts(project_id, when, count, **kwargs):
    """
    Given 'when' and 'count', which should signify recent times we compare it to historical data for this project
    and if over a given threshold, create an alert.
    """
    from sentry.constants import DEFAULT_ALERT_PROJECT_THRESHOLD
    from sentry.models import ProjectCountByMinute, ProjectOption, Alert

    # TODO: make this use the cache
    threshold, min_events = ProjectOption.objects.get_value(
        project_id, 'alert:threshold', DEFAULT_ALERT_PROJECT_THRESHOLD)

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
