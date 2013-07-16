"""
sentry.tsdb.tasks
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from celery.task import periodic_task
from celery.task.schedules import crontab


@periodic_task(
    name='sentry.tsdb.tasks.trim_points',
    run_every=crontab(minute='*'),
    queue='tsdb')
def trim_points(data, **kwargs):
    from sentry.tsdb.models import Point

    Point.objects.trim()
