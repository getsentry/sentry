from __future__ import annotations

from enum import StrEnum

from django.db import models
from django.db.models import Q

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    DefaultFieldsModel,
    FlexibleForeignKey,
    cell_silo_model,
    sane_repr,
)


class InboxActorType(StrEnum):
    """The type of actor which caused an InboxItemEvent."""

    # Sentry itself, such as an ownership rule or a finished Seer run.
    SYSTEM = "system"
    # A user, such as a user who mentioned you. The actor_id must be set in this case.
    USER = "user"


@cell_silo_model
class InboxItemEvent(DefaultFieldsModel):
    """
    One thing that happened to an InboxItem's subject, such as an assignment or a mention.
    """

    __relocation_scope__ = RelocationScope.Excluded

    # The inbox item that the event belongs to.
    inbox_item = FlexibleForeignKey(
        "notifications.InboxItem",
        related_name="events",
        on_delete=models.CASCADE,
        db_index=False,
    )
    # The type of event (e.g. "issue.mentioned").
    type = models.CharField(max_length=64)
    # The type of the actor which caused the event (SYSTEM or USER).
    actor_type = models.CharField(
        max_length=32,
        choices=[(actor_type.value, actor_type.name) for actor_type in InboxActorType],
    )
    actor_id = BoundedBigIntegerField(null=True)
    # Metadata specific to the event type, such as the comment to link to.
    data = models.JSONField(default=dict)

    class Meta:
        app_label = "notifications"
        db_table = "notifications_inboxitemevent"
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(actor_type=InboxActorType.SYSTEM.value, actor_id__isnull=True)
                    | (~Q(actor_type=InboxActorType.SYSTEM.value) & Q(actor_id__isnull=False))
                ),
                name="inboxevent_actor_id_matches_type",
            ),
        ]
        indexes = [
            models.Index(fields=["inbox_item", "-date_added"], name="inboxevent_item_date_idx"),
        ]

    __repr__ = sane_repr("id", "inbox_item_id", "type", "actor_type", "actor_id")
