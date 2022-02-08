import logging

from django.db.models import F

from sentry.signals import buffer_incr_complete
from sentry.tasks.process_buffer import process_incr
from sentry.utils.services import Service


class BufferMount(type):
    def __new__(cls, name, bases, attrs):
        new_cls = type.__new__(cls, name, bases, attrs)
        new_cls.logger = logging.getLogger(f"sentry.buffer.{new_cls.__name__.lower()}")
        return new_cls


class Buffer(Service, metaclass=BufferMount):
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

    __all__ = ("get", "incr", "process", "process_pending", "validate")

    def get(self, model, columns, filters):
        """
        We can't fetch values from Celery, so just assume buffer values are all 0 here.
        """
        return {col: 0 for col in columns}

    def incr(self, model, columns, filters, extra=None, signal_only=None):
        """
        >>> incr(Group, columns={'times_seen': 1}, filters={'pk': group.pk})
        signal_only - added to indicate that `process` should only call the complete
        signal handler with the updated model and skip creates/updates in the database. this
        is useful in cases where we need to do additional processing before writing to the
        database and opt to do it in a `buffer_incr_complete` receiver.
        """
        process_incr.apply_async(
            kwargs={
                "model": model,
                "columns": columns,
                "filters": filters,
                "extra": extra,
                "signal_only": signal_only,
            }
        )

    def process_pending(self, partition=None):
        return []

    def process(self, model, columns, filters, extra=None, signal_only=None):
        from sentry.event_manager import ScoreClause
        from sentry.models import Group

        created = False

        if not signal_only:
            update_kwargs = {c: F(c) + v for c, v in columns.items()}

            if extra:
                update_kwargs.update(extra)

            # HACK(dcramer): this is gross, but we don't have a good hook to compute this property today
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
