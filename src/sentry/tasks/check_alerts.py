"""
sentry.tasks.cleanup
~~~~~~~~~~~~~~~~~~~~

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
- Values that are not set need to constitute missing data, and we either need to ignore them or normalize them to the
  average from the before/after points

Last Notified will be tracked by using a new Alert model, which has the following properties:

- users alerted
- datetime
- type
- ident

Type and ident would be similar to how Activity works.

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from celery.task import task
from sentry import app
from sentry.utils.queue import maybe_delay


@task(ignore_result=True)
def check_alerts(**kwargs):
    """
    Iterates all current keys and checks if fires additional tasks
    to check each individual project's alert settings.
    """
    count_results = app.counter.extract_counts(prefix='project')
    when = count_results.pop('time')
    for name, results in count_results.iteritems():
        for project_id, count in results.iteritems():
            maybe_delay(check_project_alerts, name=name, project_id=project_id, when=when, count=count, expires=120)


@task(ignore_result=True)
def check_project_alerts(name, project_id, when, count, **kwargs):
    pass