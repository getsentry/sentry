from __future__ import annotations

from datetime import UTC, datetime

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    cell_silo_model,
    sane_repr,
)
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.bounded import BoundedBigIntegerField

# Sentinel for "no entries processed yet". Used as the initial cursor_date
# so that any real date_added compares greater.
EPOCH = datetime(1970, 1, 1, tzinfo=UTC)


@cell_silo_model
class GroupDerivedData(DefaultFieldsModel):
    """
    Materialized state derived from GroupActionLogEntry entries.
    One row per group (enforced by ``unique=True`` on the FK).

    Update safety
    ~~~~~~~~~~~~~
    The pipeline is deterministic: replaying the same log produces the same
    state. However, the log is not strictly append-only — historical entries
    may be inserted, which is a primary reason rebuilds are triggered.
    Three guards on the row prevent stale writes:

    * **generation_id** — set to ``max(GroupActionLogEntry.id)`` when a
      rebuild starts, capturing the log state the rebuild observed. A write
      only succeeds if its generation_id is >= the row's, so a slow
      rebuild that started before a log mutation cannot overwrite results
      from a newer rebuild that observed the corrected log.

    * **cursor guard** — within the same generation, a write only succeeds
      if the writer's ``(cursor_date, cursor_id)`` is at or ahead of the
      row's, preventing cursor regression.

    * **pipeline_hash** — stamped at row creation, incremental writes only
      succeed if the pipeline version hasn't changed since the row was
      read. A pipeline upgrade invalidates in-flight incremental work.

    Incremental processing writes per-batch with all three guards scoped
    to the row's ``id``. Rebuilds accumulate state in memory and write
    once via ``promote_to_live``, which uses the generation and cursor
    guards.

    See ``processing.py`` for the full lifecycle.
    """

    __relocation_scope__ = RelocationScope.Excluded

    group = FlexibleForeignKey("sentry.Group", unique=True)

    # Identifies the log state this row was built from.  Set to
    # ``max(GroupActionLogEntry.id)`` at the start of a rebuild so that
    # the promote guard can reject stale rebuilds that started before a
    # later log mutation triggered a newer rebuild.
    generation_id = BoundedBigIntegerField(db_default=0, default=0)

    cursor_date = models.DateTimeField(default=EPOCH)
    cursor_id = BoundedBigIntegerField(default=0)

    # Open-ended JSON object for storing derived features that don't need their own column.
    # Data in here should be kept small; we typically have to read and write the full blob.
    # If it changes frequently, needs to be indexed, or needs convenient joins, consider a column.
    data = models.JSONField(default=dict)

    # Column-backed features — promoted from JSON for indexing/querying.

    view_count = BoundedPositiveIntegerField(default=0)
    # Stores the current Progress value as a string.
    progress = models.CharField(max_length=32, null=True, default="identified")

    # The last time the above column was changed.
    last_progressed_at = models.DateTimeField(null=True, default=None)

    # Pipeline hash stamped at row creation. If it doesn't match the current
    # pipeline hash, this row wasn't fully generated with the current config
    # and needs to be regenerated.
    pipeline_hash = models.CharField(max_length=16, null=True, default=None)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupderiveddata"
        indexes = [
            models.Index(fields=["progress", "group"]),
            models.Index(fields=["last_progressed_at", "group"]),
        ]

    __repr__ = sane_repr("group_id", "generation_id", "cursor_date", "cursor_id")
