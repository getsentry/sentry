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
    One row per group. The cursor tracks the last entry processed.
    """

    __relocation_scope__ = RelocationScope.Excluded

    group = FlexibleForeignKey("sentry.Group", unique=True)
    cursor_date = models.DateTimeField(default=EPOCH)
    cursor_id = BoundedBigIntegerField(default=0)

    # Open-ended JSON object for storing derived features that don't need their own column.
    # Data in here should be kept small; we typically have to read and write the full blob.
    # If it changes frequently, needs to be indexed, or needs convenient joins, consider a column.
    data = models.JSONField(default=dict)

    # Column-backed features — promoted from JSON for indexing/querying.

    # This is here just for demonstration purposes.
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

    __repr__ = sane_repr("group_id", "cursor_date", "cursor_id")
