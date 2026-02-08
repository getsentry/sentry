from __future__ import annotations

from enum import StrEnum

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, region_silo_model, sane_repr


class NotificationThreadKeyType(StrEnum):
    """
    The sender key for a notification thread.
    """

    ISSUE_ALERT = "issue_alert"
    METRIC_ALERT = "metric_alert"
    NOA = "noa"


@region_silo_model
class NotificationThread(DefaultFieldsModel):
    """
    Tracks thread context for threaded notifications.

    The thread_key is a hash of key_type + key_data, which allows for efficient lookups
    without needing to query by multiple fields. The key_type and key_data fields store
    the original values for debugging and auditing purposes.

    Example key_data for different notification types:
    - issue_alert: {"rule_fire_history_id": 123, "rule_action_uuid": "abc-123"}
    - metric_alert: {"alert_rule_id": 456, "incident_id": 789, "trigger_action_id": 101}
    - noa: {"action_id": 111, "group_id": 222}
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
        choices=[(k.value, k.name) for k in NotificationThreadKeyType],
    )
    key_data = models.JSONField()

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

    __repr__ = sane_repr("id", "thread_key", "provider_key", "thread_identifier")
