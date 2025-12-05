import logging
from datetime import datetime
from typing import Any

import psycopg2.errors
from django.db import DataError
from django.db.models import F

from sentry.db import models
from sentry.db.models.fields.bounded import BoundedPositiveIntegerField
from sentry.signals import buffer_incr_complete
from sentry.tasks.process_buffer import process_incr
from sentry.utils import metrics
from sentry.utils.services import Service

logger = logging.getLogger(__name__)

BufferField = models.Model | str | int


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

    __all__ = (
        "get",
        "incr",
        "process",
        "process_pending",
        "validate",
        "push_to_sorted_set",
        "push_to_hash",
        "get_sorted_set",
        "get_hash",
        "get_hash_length",
        "delete_hash",
        "delete_key",
    )

    def get(
        self,
        model: type[models.Model],
        columns: list[str],
        filters: dict[str, Any],
    ) -> dict[str, int]:
        """
        We can't fetch values from tasks, so just assume buffer values are all 0 here.
        """
        return {col: 0 for col in columns}

    def get_hash(self, model: type[models.Model], field: dict[str, BufferField]) -> dict[str, str]:
        return {}

    def get_hash_length(self, model: type[models.Model], field: dict[str, BufferField]) -> int:
        raise NotImplementedError

    def get_sorted_set(self, key: str, min: float, max: float) -> list[tuple[int, float]]:
        return []

    def bulk_get_sorted_set(
        self, keys: list[str], min: float, max: float
    ) -> dict[int, list[float]]:
        return {}

    def push_to_sorted_set(self, key: str, value: list[int] | int) -> None:
        return None

    def push_to_hash(
        self,
        model: type[models.Model],
        filters: dict[str, BufferField],
        field: str,
        value: str,
    ) -> None:
        return None

    def push_to_hash_bulk(
        self,
        model: type[models.Model],
        filters: dict[str, BufferField],
        data: dict[str, str],
    ) -> None:
        raise NotImplementedError

    def delete_hash(
        self,
        model: type[models.Model],
        filters: dict[str, BufferField],
        fields: list[str],
    ) -> None:
        return None

    def delete_key(self, key: str, min: float, max: float) -> None:
        return None

    def delete_keys(self, keys: list[str], min: float, max: float) -> None:
        return None

    def incr(
        self,
        model: type[models.Model],
        columns: dict[str, int],
        filters: dict[str, BufferField],
        extra: dict[str, Any] | None = None,
        signal_only: bool | None = None,
    ) -> None:
        """
        >>> incr(Group, columns={'times_seen': 1}, filters={'pk': group.pk})

        model - The model whose records will be updated

        columns - Columns whose values should be incremented, in the form
        { column_name: increment_amount }

        filters - kwargs to pass to `<model_class>.objects.get` to select the records which will be
        updated

        extra - Other columns whose values should be changed, in the form
        { column_name: new_value }. This is separate from `columns` because existing values in those
        columns are incremented, whereas existing values in these columns are fully overwritten with
        the new values.

        signal_only - Added to indicate that `process` should only call the `buffer_incr_complete`
        signal handler with the updated model and skip creates/updates in the database. This is useful
        in cases where we need to do additional processing before writing to the database and opt to do
        it in a `buffer_incr_complete` receiver.
        """
        if extra:
            for key, value in extra.items():
                if isinstance(value, datetime):
                    extra[key] = value.isoformat()

        process_incr.apply_async(
            kwargs={
                "model_name": f"{model._meta.app_label}.{model._meta.model_name}",
                "columns": columns,
                "filters": filters,
                "extra": extra,
                "signal_only": signal_only,
            },
            headers={"sentry-propagate-traces": False},
        )

    def process_pending(self) -> None:
        return

    def process(
        self,
        model: type[models.Model] | None,
        columns: dict[str, int] | None,
        filters: dict[str, Any] | None,
        extra: dict[str, Any] | None = None,
        signal_only: bool | None = None,
    ) -> None:
        from sentry.models.group import Group

        if not columns:
            columns = {}
        if not filters:
            filters = {}

        created = False

        if not signal_only:
            update_kwargs: dict[str, Any] = {c: F(c) + v for c, v in columns.items()}

            if extra:
                # Because of the group.update() below, we need to parse
                # datetime strings back into datetime objects. This ensures that
                # the cache data contains the correct type.
                for key in ("last_seen", "first_seen"):
                    if key in extra and isinstance(extra[key], str):
                        extra[key] = datetime.fromisoformat(extra[key])
                update_kwargs.update(extra)
            # HACK(dcramer): this is gross, but we don't have a good hook to compute this property today
            # XXX(dcramer): remove once we can replace 'priority' with something reasonable via Snuba
            if model is Group:
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
                    # Skip times_seen increment if already at MAX INT, but still update other fields
                    if (
                        "times_seen" in update_kwargs
                        and group.times_seen == BoundedPositiveIntegerField.MAX_VALUE
                    ):
                        del update_kwargs["times_seen"]
                        metrics.incr(
                            "buffer.times_seen_already_max",
                            tags={"reason": "skip_increment"},
                        )

                    if update_kwargs:
                        try:
                            group.update(using=None, **update_kwargs)
                        except DataError as e:
                            # Catch NumericValueOutOfRange when times_seen exceeds 32-bit limit
                            if (
                                isinstance(e.__cause__, psycopg2.errors.NumericValueOutOfRange)
                                and "times_seen" in update_kwargs
                            ):
                                # Cap times_seen to BoundedPositiveIntegerField.MAX_VALUE and retry the update
                                update_kwargs["times_seen"] = BoundedPositiveIntegerField.MAX_VALUE
                                try:
                                    group.update(using=None, **update_kwargs)
                                    metrics.incr(
                                        "buffer.times_seen_capped",
                                        tags={"reason": "integer_overflow"},
                                    )
                                except Exception:
                                    # If the capped update also fails, log and skip
                                    metrics.incr(
                                        "buffer.times_seen_cap_failed",
                                        tags={"reason": "retry_failed"},
                                    )
                                    logger.exception(
                                        "buffer.skip_group_update_after_cap_failed",
                                        extra={
                                            "group_id": getattr(group, "id", None),
                                            "filters": filters,
                                        },
                                    )
                            else:
                                # Re-raise if it's not an integer overflow error
                                raise
                created = False
            elif model:
                _, created = model.objects.create_or_update(values=update_kwargs, **filters)

        buffer_incr_complete.send_robust(
            model=model,
            columns=columns,
            filters=filters,
            extra=extra,
            created=created,
            sender=model,
        )
