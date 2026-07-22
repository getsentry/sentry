from __future__ import annotations

from datetime import UTC, datetime

from django.db import models
from django.db.models.functions import Now
from django.utils import timezone

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
    may be inserted, which is a primary reason generations are triggered.

    * **generated_at** — timestamp of when the generation that produced
      this row's current state *started* processing. This is a CAS version:
      incremental writes only succeed if ``generated_at`` hasn't changed
      since the row was read, and generation promotes only succeed if their
      ``generated_at`` is newer than the row's.  The start time (rather
      than finish time) reflects the log state the generation observed.

    * **cursor guard** — incremental writes only succeed if the writer's
      ``(cursor_date, cursor_id)`` is at or ahead of the row's, preventing
      cursor regression.

    * **pipeline_hash** — stamped at row creation, incremental writes only
      succeed if the pipeline version hasn't changed since the row was
      read. A pipeline upgrade invalidates in-flight incremental work.

    See ``processing.py`` for the full lifecycle.
    """

    __relocation_scope__ = RelocationScope.Excluded

    group = FlexibleForeignKey("sentry.Group", unique=True)

    # Timestamp of when the generation that produced this state *started*
    # processing. Defaults to row creation time.
    generated_at = models.DateTimeField(default=timezone.now, db_default=Now())

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

    # The last time ``progress`` was changed.
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
            models.Index(fields=["pipeline_hash", "group"]),
        ]

    __repr__ = sane_repr("group_id", "generated_at", "cursor_date", "cursor_id")
