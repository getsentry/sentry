"""
sentry.tasks.index
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from celery.task import task


@task(name='sentry.tasks.index.index_event', queue='search')
def index_event(event, **kwargs):
    from sentry import app

    app.search.index(event.group, event)
