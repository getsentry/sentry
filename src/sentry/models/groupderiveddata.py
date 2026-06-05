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
    Storage backend for derived state computed from GroupActionLogEntry entries.

    One row per (group, version) pair. The `primary` flag marks which row
    readers should use. The cursor tracks the last entry processed.
    """

    __relocation_scope__ = RelocationScope.Excluded

    group = FlexibleForeignKey("sentry.Group")
    version = BoundedPositiveIntegerField(default=1)
    cursor_date = models.DateTimeField(default=EPOCH)
    cursor_id = BoundedBigIntegerField(default=0)
    data = models.JSONField(default=dict)
    primary = models.BooleanField(default=False)

    # Column-backed features — promoted from JSON for indexing/querying.
    last_seen = models.FloatField(null=True, default=None)
    view_count = BoundedPositiveIntegerField(default=0)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupderiveddata"
        unique_together = (("group", "version"),)
        indexes = [
            models.Index(fields=["version"]),
            models.Index(fields=["group", "primary"]),
        ]

    __repr__ = sane_repr("group_id", "version", "cursor_date", "cursor_id", "primary")
