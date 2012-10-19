"""
sentry.tasks.store
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from celery.task import task


@task(ignore_result=True)
def store_event(data, **kwargs):
    """
    Saves an event to the database.
    """
    from sentry.models import Group

    Group.objects.from_kwargs(**data)
