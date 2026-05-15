from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models.functions import Now

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    Model,
    cell_silo_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.issues.derived.types import IssueActionType


@cell_silo_model
class IssueActionLog(Model):
    """
    Append-only log of actions taken on an issue (Group).

    Used as input to derive computed Group attributes via the aggregator pipeline.
    Each entry records who did what, when, with optional structured payload.

    Entries are ordered by (group, date_added, id) for processing. The standard
    path gets date_added from the DB default (now()); backfill code can set it
    explicitly to insert entries at the correct chronological position.

    Actor is currently just user_id (nullable for system-initiated actions).
    """

    __relocation_scope__ = RelocationScope.Excluded

    # References sentry.Group. No FK constraint — this table will live on a separate DB.
    group_id = BoundedBigIntegerField()
    # An IssueActionType value.
    type = BoundedPositiveIntegerField(
        choices=[(t.value, t.name) for t in IssueActionType],
    )
    # The user who performed the action, or NULL for a system action.
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="DO_NOTHING")

    # JSON representation of the IssueAction subclass for this type.
    data = models.JSONField(default=dict)

    # When the action occurred. DB-defaulted to now(); not set by record().
    # Backfill code can pass an explicit value to place entries chronologically.
    date_added = models.DateTimeField(db_default=Now())

    # Optional idempotency key for deduplicating events from external sources
    # (e.g., a webhook delivery ID, a PR merge event ID). When set, the partial
    # unique index on (group, idempotency_key) prevents the same external event
    # from being recorded twice. Null for internally-sourced events, which do
    # not need deduplication at the log level.
    idempotency_key = models.CharField(max_length=64, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_issueactionlog"
        indexes = [
            models.Index(fields=["group_id", "date_added", "id"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["group_id", "idempotency_key"],
                name="uniq_issueactionlog_group_idempotency_key",
                condition=models.Q(idempotency_key__isnull=False),
            ),
        ]

    __repr__ = sane_repr("group_id", "type", "user_id")
