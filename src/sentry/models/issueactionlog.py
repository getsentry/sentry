from __future__ import annotations

from django.conf import settings
from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
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

    Actor is currently just user_id (nullable for system-initiated actions).
    """

    __relocation_scope__ = RelocationScope.Excluded

    group = FlexibleForeignKey("sentry.Group")
    type = BoundedPositiveIntegerField(
        choices=[(t.value, t.name) for t in IssueActionType],
    )
    # The user who performed the action, or NULL for a system action.
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="DO_NOTHING")

    # JSON representation of the Action subclass for this type.
    data = models.JSONField(default=dict)

    date_added = models.DateTimeField(auto_now_add=True)

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
            models.Index(fields=["group", "id"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["group", "idempotency_key"],
                name="uniq_issueactionlog_group_idempotency_key",
                condition=models.Q(idempotency_key__isnull=False),
            ),
        ]

    __repr__ = sane_repr("group_id", "type", "user_id")
