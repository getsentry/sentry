"""
sentry.tasks.index
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from sentry.tasks.base import instrumented_task


@instrumented_task(name='sentry.tasks.index.index_event', queue='search')
def index_event(event, **kwargs):
    from sentry import app

    app.search.index(event)
