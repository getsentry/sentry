from datetime import datetime
from typing import Any

from django.db.models import Expression, F

from sentry.db import models
from sentry.signals import buffer_incr_complete
from sentry.tasks.process_buffer import process_incr
from sentry.utils.services import Service


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

    __all__ = ("get", "incr", "process", "process_pending", "process_batch", "validate")

    def get(
        self,
        model: type[models.Model],
        columns: list[str],
        filters: dict[str, Any],
    ) -> dict[str, int]:
        """
        We can't fetch values from Celery, so just assume buffer values are all 0 here.
        """
        return {col: 0 for col in columns}

    def get_hash(
        self, model: type[models.Model], field: dict[str, models.Model | str | int]
    ) -> dict[str, str]:
        return {}

    def get_sorted_set(self, key: str, min: float, max: float) -> list[tuple[int, datetime]]:
        return []

    def incr(
        self,
        model: type[models.Model],
        columns: dict[str, int],
        filters: dict[str, models.Model | str | int],
        extra: dict[str, Any] | None = None,
        signal_only: bool | None = None,
    ) -> None:
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

    def process_pending(self) -> None:
        return

    def process_batch(self) -> None:
        return

    def process(
        self,
        model: type[models.Model],
        columns: dict[str, int],
        filters: dict[str, Any],
        extra: dict[str, Any] | None = None,
        signal_only: bool | None = None,
    ) -> None:
        from sentry.event_manager import ScoreClause
        from sentry.models.group import Group

        created = False

        if not signal_only:
            update_kwargs: dict[str, Expression] = {c: F(c) + v for c, v in columns.items()}

            if extra:
                update_kwargs.update(extra)

            # HACK(dcramer): this is gross, but we don't have a good hook to compute this property today
            # XXX(dcramer): remove once we can replace 'priority' with something reasonable via Snuba
            if model is Group:
                if "last_seen" in update_kwargs and "times_seen" in update_kwargs:
                    update_kwargs["score"] = ScoreClause(
                        group=None,
                        times_seen=update_kwargs["times_seen"],
                        last_seen=update_kwargs["last_seen"],
                    )
                # XXX: create_or_update doesn't fire `post_save` signals, and so this update never
                # ends up in the cache. This causes issues when handling issue alerts, and likely
                # elsewhere. Use `update` here since we're already special casing, and we know that
                # the group will already exist.
                try:
                    group = Group.objects.get(**filters)
                except Group.DoesNotExist:
                    # If the group was deleted by the time we flush buffers we don't care, just
                    # continue
                    pass
                else:
                    group.update(**update_kwargs)
                created = False
            else:
                _, created = model.objects.create_or_update(values=update_kwargs, **filters)

        buffer_incr_complete.send_robust(
            model=model,
            columns=columns,
            filters=filters,
            extra=extra,
            created=created,
            sender=model,
        )
