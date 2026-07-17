from __future__ import annotations

import functools

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
from sentry.issues.action_log.types import GroupAction, GroupActionType, GroupActorType


@cell_silo_model
class GroupActionLogEntry(Model):
    """
    Append-only log of actions taken on a Group.

    Each entry records who did what, when, with optional structured payload.
    Ordered by (group_id, date_added, id).

    **Do not create or update rows directly.** Use the helpers in
    ``sentry.issues.action_log`` instead.
    """

    __relocation_scope__ = RelocationScope.Excluded

    # The id of the Group currently associated with this action.
    group_id = BoundedBigIntegerField()
    # The project the group belongs to.
    project_id = BoundedBigIntegerField()
    # The group_id before any merges, if this entry was migrated.
    original_group_id = BoundedBigIntegerField(null=True)

    # A GroupActionType value.
    type = BoundedPositiveIntegerField(
        choices=[(t.value, t.name) for t in GroupActionType],
    )

    actor_type = BoundedPositiveIntegerField(
        choices=[(t.value, t.name) for t in GroupActorType],
    )
    actor_id = BoundedBigIntegerField()

    # Where the action originated (e.g. "web", "api", "mcp:cursor").
    # Usually an ActionSource value, but may include sub-source qualifiers.
    source = models.CharField(max_length=64)

    # JSON payload of the GroupAction subclass for this type.
    data = models.JSONField(default=dict)

    # DB-defaulted; backfill code may pass an explicit value.
    date_added = models.DateTimeField(db_default=Now())

    # Primarly intended for debugging; not intended to be relied upon
    # for invalidation.
    date_updated = models.DateTimeField(db_default=Now(), auto_now=True)

    # Unique identifier for external action this corresponds to.
    # Primarly exists to make backfilling third party actions simpler.
    idempotency_key = models.CharField(max_length=64, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupactionlogentry"
        indexes = [
            models.Index(fields=["group_id", "date_added", "id"]),
            models.Index(fields=["project_id", "group_id"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["group_id", "idempotency_key"],
                name="uniq_groupactionlogentry_group_idempotency_key",
                condition=models.Q(idempotency_key__isnull=False),
            ),
        ]

    __repr__ = sane_repr("group_id", "type", "actor_type", "actor_id")

    @functools.cached_property
    def action(self) -> GroupAction:
        action_type = GroupActionType(self.type)
        action_cls = GroupAction.by_type(action_type)
        if action_cls is None:
            raise ValueError(f"No GroupAction registered for {action_type!r}")
        return action_cls(**self.data)
