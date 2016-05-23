"""
sentry.tasks.process_buffer
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from sentry.tasks.base import instrumented_task


@instrumented_task(
    name='sentry.tasks.process_buffer.process_pending')
def process_pending():
    """
    Process pending buffers.
    """
    from sentry import app
    lock = app.locks.get('buffer:process_pending', duration=60)
    with lock.acquire():
        app.buffer.process_pending()


@instrumented_task(
    name='sentry.tasks.process_buffer.process_incr')
def process_incr(**kwargs):
    """
    Processes a buffer event.
    """
    from sentry import app

    app.buffer.process(**kwargs)
