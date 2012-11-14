"""
sentry.tasks.process_buffer
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from celery.task import task


@task(ignore_result=True)
def process_incr(**kwargs):
    """
    Processes a buffer event.
    """
    from sentry import app

    app.buffer.process(**kwargs)
