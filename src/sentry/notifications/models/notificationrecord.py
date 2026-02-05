from __future__ import annotations

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, region_silo_model, sane_repr


@region_silo_model
class NotificationRecord(Model):
    """
    Tracks individual messages sent via the notification platform.

    Every message sent through the platform with threading enabled gets a NotificationRecord.
    This allows us to track message delivery status, errors, and maintain a history of
    notifications for a given thread.

    The thread field links to the NotificationThread, which is created eagerly on the first
    message when threading is requested.
    """

    __relocation_scope__ = RelocationScope.Excluded

    # Thread association - always populated when threading is enabled
    thread = FlexibleForeignKey(
        "notifications.NotificationThread",
        related_name="records",
        null=True,
        on_delete=models.CASCADE,
    )

    # Provider identification
    provider_key = models.CharField(max_length=32)  # "slack", "discord", "msteams"
    target_id = models.CharField(max_length=255)  # channel_id, conversation_id, etc.

    # Message identifier (provider-specific)
    message_id = models.CharField(max_length=255)

    # Error tracking - populated when send fails
    error_details = models.JSONField(null=True)

    date_added = models.DateTimeField(default=timezone.now)
    date_updated = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "notifications"
        db_table = "sentry_notificationrecord"
        indexes = [
            # For looking up messages by thread
            models.Index(
                fields=["thread", "date_added"],
                name="idx_notifrecord_thread_date",
            ),
        ]

    __repr__ = sane_repr("id", "thread_id", "provider_key", "message_id")
