from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.utils import timezone

from sentry import models
from sentry.db.models.base import Model
from sentry.platform_example.notification_digest_strategy import (
    NotificationDigestBackend,
    NotificationDigestStrategy,
)
from sentry.platform_example.notification_target import (
    NotificationTarget,
    NotificationTargetStrategy,
    NotificationType,
)


class Notification(Model):
    thread_id = models.CharField(null=False, max_length=128)
    source = models.CharField(null=False, choices=NotificationType.get_choices(), max_length=30)
    # Duplicated data from NotificationTarget, storing here for audit purposes
    target_data = models.JSONField(null=False)
    delivered_at = models.DateTimeField(null=False, default=timezone.now)


@dataclass
class NotificationTemplate:
    template_data: dict


class NotificationService:
    @classmethod
    def notify(
        target_strategy: NotificationTargetStrategy,
        template: NotificationTemplate,
        data: dict[str, Any],
        notification_type: NotificationType,
        thread_id: str | None = None,
    ):
        # targets = target_strategy.get_targets(notification_type)

        # Deduplicate targets
        # Validate the template & Data
        # Per notification target, find the correct provider
        # If user, get user settings, preferences, fan out to different specified providers
        # Notify via the provider by queueing a task, an outbox with an RPC, etc
        # TODO(Gabe): Figure out if some emails need overrides/specific requirements
        pass


class NotificationDigestService:
    digest_strategy: NotificationDigestStrategy
    digest_backend: NotificationDigestBackend

    def enqueue_notification(
        self,
        data: dict[str, Any],
        notification_type: NotificationType,
        target: NotificationTarget,
    ):
        pass
