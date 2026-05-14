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
    One storage backend for derived state computed from IssueActionLog entries.

    This is not the only place derived data could live — the pipeline's
    output is a plain dict that could be written to Redis, a separate
    service, or materialized into dedicated columns elsewhere. This model
    is the current default backend: one row per (group, version) pair,
    stored as a JSON blob in Postgres.

    The `version` field identifies the pipeline definition that produced
    this data. Multiple versions can coexist for the same group during
    pipeline transitions.

    The `primary` flag marks which row readers should use. Writers control
    when to flip this — e.g., once a new version catches up, or immediately
    for new groups. At most one row per group should be primary. Readers
    filter on `primary=True` and don't need to reason about versions.

    The cursor (cursor_date, cursor_id) tracks the last IssueActionLog entry
    processed under this version. Entries are ordered by (date_added, id).
    """

    __relocation_scope__ = RelocationScope.Excluded

    group = FlexibleForeignKey("sentry.Group")
    version = BoundedPositiveIntegerField(default=1)
    cursor_date = models.DateTimeField(default=EPOCH)
    cursor_id = BoundedBigIntegerField(default=0)
    data = models.JSONField(default=dict)
    primary = models.BooleanField(default=False)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupderiveddata"
        unique_together = (("group", "version"),)
        indexes = [
            models.Index(fields=["version"]),
            models.Index(fields=["group", "primary"]),
        ]

    __repr__ = sane_repr("group_id", "version", "cursor_date", "cursor_id", "primary")
