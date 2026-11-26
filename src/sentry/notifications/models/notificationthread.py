from __future__ import annotations

from enum import StrEnum

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, DefaultFieldsModel, cell_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.notifications.platform.types import NotificationSource


class NotificationThreadObjectType(StrEnum):
    """The kind of object a NotificationThread is about, which object_id points to."""

    GROUP = "group"
    INVESTIGATION = "investigation"


@cell_silo_model
class NotificationThread(DefaultFieldsModel):
    """
    Tracks thread context for threaded notifications.

    The thread_key is a hash of key_type + key_data, which allows for efficient lookups
    without needing to query by multiple fields. The key_type and key_data fields store
    the original values for debugging and auditing purposes.

    object_type and object_id identify the object the thread is about (e.g. the group for issue
    and metric alert threads). They let callers find every thread for an object without knowing
    the full key, across key types. They are not part of thread_key.

    key_type uses NotificationSource values. Example key_data for different sources:
    - slow-load-metric-alert: {"alert_rule_id": 456, "incident_id": 789, "trigger_action_id": 101}
    - issue_alert: {"action_id": 123, "group_id": 456, "open_period_start": "2025-01-01T00:00:00Z"}
    """

    __relocation_scope__ = RelocationScope.Excluded

    # Lookup key (hash of key_type + key_data) - indexed for fast lookups
    thread_key = models.CharField(max_length=64, db_index=True)

    # Provider identification
    provider_key = models.CharField(max_length=32)  # "slack", "discord", "msteams"
    target_id = models.CharField(max_length=255)  # channel_id, conversation_id, etc.

    # Identifier for the thread given by the provider
    thread_identifier = models.CharField(max_length=255)

    # Extensible key storage (for debugging/auditing)
    key_type = models.CharField(
        max_length=64,
        db_index=True,
        choices=[(source.value, source.name) for source in NotificationSource],
    )
    key_data = models.JSONField()

    object_type = models.CharField(
        max_length=64,
        null=True,
        choices=[
            (object_type.value, object_type.name) for object_type in NotificationThreadObjectType
        ],
    )
    object_id = BoundedBigIntegerField(null=True)

    integration_id = HybridCloudForeignKey(
        "sentry.Integration", blank=True, null=True, on_delete="CASCADE"
    )

    provider_data = models.JSONField(default=dict)

    class Meta:
        app_label = "notifications"
        db_table = "notifications_notificationthread"
        constraints = [
            models.UniqueConstraint(
                fields=["thread_key", "provider_key", "target_id"],
                name="uniq_notification_thread_per_provider_target",
            ),
        ]
        indexes = [
            # Lookups by object (e.g. every thread for an issue) can't use thread_key, which
            # hashes the full key.
            models.Index(fields=["object_type", "object_id"], name="idx_notifthread_object"),
        ]

    __repr__ = sane_repr("id", "thread_key", "provider_key", "thread_identifier")
