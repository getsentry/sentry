"""
sentry.tasks.process_buffer
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from sentry.utils.logging import suppress_exceptions
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name='sentry.tasks.process_buffer.process_pending')
def process_pending():
    """
    Process pending buffers.
    """
    from sentry import app

    app.buffer.process_pending()


@instrumented_task(
    name='sentry.tasks.process_buffer.process_incr')
@suppress_exceptions
def process_incr(**kwargs):
    """
    Processes a buffer event.
    """
    from sentry import app

    app.buffer.process(**kwargs)
