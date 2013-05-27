"""
sentry.buffer.base
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.db.models import F
from sentry.signals import buffer_incr_complete, buffer_delay_complete
from sentry.tsdb.models import Key, Point
from sentry.tasks.process_buffer import process_incr, process_delay


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

    def incr(self, key, amount=1, timestamp=None):
        """
        >>> incr('foo.bar')
        """
        process_incr.apply_async(kwargs={
            'key': key,
            'amount': amount,
            'timestamp': timestamp,
        }, countdown=self.countdown)

    def delay(self, model, columns, filters, extra=None):
        """
        >>> delay(Group, columns={'times_seen': 1}, filters={'pk': group.pk})
        """
        process_delay.apply_async(kwargs={
            'model': model,
            'columns': columns,
            'filters': filters,
            'extra': extra,
        }, countdown=self.countdown)

    def process_incr(self, key, amount=1, timestamp=None):
        key = Key.objects.get_or_create(key=key)[0]

        Point.objects.incr(
            key=key,
            amount=amount,
            timestamp=timestamp,
        )

        buffer_incr_complete.send_robust(
            key=key,
            amount=amount,
            timestamp=timestamp,
            sender=type(self),
        )

    def process_delay(self, model, columns, filters, extra=None):
        update_kwargs = dict((c, F(c) + v) for c, v in columns.iteritems())
        if extra:
            update_kwargs.update(extra)

        _, created = model.objects.create_or_update(
            defaults=update_kwargs,
            **filters
        )

        buffer_delay_complete.send_robust(
            model=model,
            columns=columns,
            filters=filters,
            extra=extra,
            created=created,
            sender=model,
        )
