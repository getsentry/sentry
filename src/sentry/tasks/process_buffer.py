"""
sentry.tasks.process_buffer
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from celery.task import task


@task(name='sentry.tasks.process_buffer.process_incr', queue='counters')
def process_incr(**kwargs):
    """
    Processes a buffer event.
    """
    from sentry import app

    app.buffer.process(**kwargs)
