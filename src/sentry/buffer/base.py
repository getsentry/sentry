"""
sentry.buffer.base
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from sentry.signals import buffer_delay_complete
from sentry.tasks.process_buffer import process_delay


class Buffer(object):
    """
    Buffers act as temporary stores for counters. The default implementation is just a passthru and
    does not actually buffer anything.

    A useful example might be a Redis buffer. Each time an event gets updated, we send several
    add events which just store a key and increment its value. Additionally they fire off a task
    to the queue. That task eventually runs and gets the current update value. If the value is
    empty, it does nothing, otherwise it updates the row in the database.

    This is useful in situations where a single event might be happening so fast that the queue cant
    keep up with the updates.
    """
    def __init__(self, delay=5, **options):
        self.countdown = delay

    def delay(self, callback, args=None, values=None):
        """
        >>> delay(callback, values={'foo': F('foo') + 1})
        """
        if not values:
            return

        process_delay.apply_async(kwargs={
            'callback': callback,
            'args': args,
            'values': values,
        }, countdown=self.countdown)

    def process(self, callback, args=None, values=None):
        if not values:
            return

        callback(*args or (), values=values)

        buffer_delay_complete.send_robust(
            callback=callback,
            args=args,
            values=values,
            sender=type(self),
        )
