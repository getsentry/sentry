"""
sentry.tasks.check_alerts
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, division

import logging

from datetime import datetime, timedelta
from pytz import utc

from sentry.tasks.base import instrumented_task
from sentry.utils import math


logger = logging.getLogger('alerts')


def fsteps(start, stop, steps):
    step = (stop - start) / steps
    while start <= stop:
        yield start
        start += step


@instrumented_task(name='sentry.tasks.check_alerts', queue='alerts')
def check_alerts(**kwargs):
    """
    Iterates all current keys and fires additional tasks to check each individual
    project's alert settings.
    """
    from sentry.models import Project

    # TODO(dcramer): we'd rather limit this to projects which we know are 'active'
    # this could be done using a similar strategy to our update buffer flushing
    for project_id in Project.objects.values_list('id', flat=True):
        check_project_alerts.apply_async(
            kwargs={'project_id': project_id},
            expires=120,
        )


@instrumented_task(name='sentry.tasks.check_alerts.check_project_alerts', queue='alerts')
def check_project_alerts(project_id, **kwargs):
    """
    Given 'when' and 'count', which should signify recent times we compare it to
    historical data for this project and if over a given threshold, create an
    alert.
    """
    from sentry.app import tsdb
    from sentry.constants import DEFAULT_ALERT_PROJECT_THRESHOLD
    from sentry.models import ProjectOption, Alert

    threshold, min_events = ProjectOption.objects.get_value(
        project_id, 'alert:threshold', DEFAULT_ALERT_PROJECT_THRESHOLD)

    if not threshold and min_events:
        return

    end = datetime.now().replace(tzinfo=utc) - timedelta(seconds=10)
    start = end - timedelta(minutes=5)

    results = [v for _, v in tsdb.get_range(
        tsdb.models.project,
        [project_id],
        start=start,
        end=end,
        rollup=10,
    )[project_id]]

    half_intervals = int(len(results) / 2)
    previous_data, current_data = results[:half_intervals], results[half_intervals:]

    if not current_data:
        return

    current_avg = sum(current_data) / len(current_data)

    # if there first few points within previous data are empty, assume that the
    # project hasn't been active long enough for rates to be valid
    if not any(previous_data[:3]):
        return

    if min_events > current_avg:
        return

    mean = math.mean(previous_data)
    dev = math.mad(previous_data)
    previous_avg = (mean + dev * 2)

    pct_increase = (current_avg / previous_avg * 100) - 100

    logger.info('Rate of events for project %d changed from %.2f to %2.f',
        project_id, previous_avg, current_avg)

    if pct_increase > threshold and current_avg > previous_avg:
        Alert.maybe_alert(
            project_id=project_id,
            message='Rate of events increased from %.2f to %.2f' % (previous_avg, current_avg),
        )
