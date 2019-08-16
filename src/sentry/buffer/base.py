from __future__ import absolute_import

import logging
import six

from django.db.models import F

from sentry.signals import buffer_incr_complete
from sentry.tasks.process_buffer import process_incr
from sentry.utils.services import Service


class BufferMount(type):
    def __new__(cls, name, bases, attrs):
        new_cls = type.__new__(cls, name, bases, attrs)
        new_cls.logger = logging.getLogger("sentry.buffer.%s" % (new_cls.__name__.lower(),))
        return new_cls


@six.add_metaclass(BufferMount)
class Buffer(Service):
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

    __all__ = ("incr", "process", "process_pending", "validate")

    def incr(self, model, columns, filters, extra=None):
        """
        >>> incr(Group, columns={'times_seen': 1}, filters={'pk': group.pk})
        """
        process_incr.apply_async(
            kwargs={"model": model, "columns": columns, "filters": filters, "extra": extra}
        )

    def process_pending(self, partition=None):
        return []

    def process(self, model, columns, filters, extra=None):
        from sentry.models import Group
        from sentry.event_manager import ScoreClause

        update_kwargs = dict((c, F(c) + v) for c, v in six.iteritems(columns))
        if extra:
            update_kwargs.update(extra)

        # HACK(dcramer): this is gross, but we dont have a good hook to compute this property today
        # XXX(dcramer): remove once we can replace 'priority' with something reasonable via Snuba
        if model is Group and "last_seen" in update_kwargs and "times_seen" in update_kwargs:
            update_kwargs["score"] = ScoreClause(
                group=None,
                times_seen=update_kwargs["times_seen"],
                last_seen=update_kwargs["last_seen"],
            )

        _, created = model.objects.create_or_update(values=update_kwargs, **filters)

        buffer_incr_complete.send_robust(
            model=model,
            columns=columns,
            filters=filters,
            extra=extra,
            created=created,
            sender=model,
        )
