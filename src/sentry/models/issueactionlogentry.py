from __future__ import annotations

from enum import IntEnum

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
from sentry.issues.derived.types import IssueActionType


class ActorType(IntEnum):
    SYSTEM = 0
    USER = 1


@cell_silo_model
class IssueActionLogEntry(Model):
    """
    Append-only log of actions taken on an issue (Group).

    Each entry records who did what, when, with optional structured payload.

    Entries are ordered by (group, date_added, id) for processing. The standard
    path gets date_added from the DB default (now()); backfill code can set it
    explicitly to insert entries at the correct chronological position.
    """

    __relocation_scope__ = RelocationScope.Excluded

    # References sentry.Group. No FK constraint — this table will live on a separate DB.
    group_id = BoundedBigIntegerField()
    # The project the group belonged to when this entry was logged.
    project_id = BoundedBigIntegerField()
    # When a group is merged into another, this records the original group ID.
    original_group_id = BoundedBigIntegerField(null=True)

    # An IssueActionType value.
    type = BoundedPositiveIntegerField(
        choices=[(t.value, t.name) for t in IssueActionType],
    )

    actor_type = BoundedPositiveIntegerField(
        choices=[(t.value, t.name) for t in ActorType],
    )
    actor_id = BoundedBigIntegerField()

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
        db_table = "sentry_issueactionlogentry"
        indexes = [
            models.Index(fields=["group_id", "date_added", "id"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["group_id", "idempotency_key"],
                name="uniq_issueactionlogentry_group_idempotency_key",
                condition=models.Q(idempotency_key__isnull=False),
            ),
        ]

    __repr__ = sane_repr("group_id", "type", "actor_type", "actor_id")
