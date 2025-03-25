from __future__ import annotations

import uuid
from abc import ABC
from dataclasses import dataclass
from typing import Any, Generic, TypedDict, TypeVar

from django.db import models
from django.utils import timezone

from sentry.db.models.base import Model
from sentry.platform_example.notification_target import NotificationTarget, NotificationType


class NotificationData(TypedDict):
    message: str


class Notification(Model):
    thread_id = models.CharField(null=False, max_length=128)
    batch_id = models.UUIDField(null=False, default=uuid.uuid4)
    source = models.CharField(null=False, choices=NotificationType.get_choices(), max_length=30)
    # Duplicated data from NotificationTarget, storing here for audit purposes
    target_data = models.JSONField(null=False)
    delivered_at = models.DateTimeField(null=False, default=timezone.now)


T = TypeVar("T", bound=NotificationData)


@dataclass
class NotificationTemplate(Generic[T], ABC):
    template_data: dict[str, Any]
    notification_type: NotificationType


class NotificationService(Generic[T]):
    """
    Service for sending notifications to targets.

    The service is responsible for:
    - Validating the template & data
    - Querying notification settings for provided targets
    - Dispatching notifications via a task, an outbox with an RPC, etc to the appropriate providers
    - Creating a notification model per target
    - Handling threading concerns
    """

    @staticmethod
    def notify(
        target: NotificationTarget,
        template: NotificationTemplate[T],
        data: T,
        thread_id: str | None = None,
    ) -> str:
        """
        Send a notification to a single target. Targets can be a user,
        an integration resource, or a team.
        """
        return ""

    @staticmethod
    def notify_many(
        targets: list[NotificationTarget],
        template: NotificationTemplate[T],
        data: T,
        thread_id: str | None = None,
    ) -> str:
        """
        Send a notification to multiple targets. Targets can be a user,
        an integration resource, or a team.

        Conceptually, notify_many is sending a single notifiation to
        many targets.

        Per target, the appropriate providers will be selected, a notification
        model will be created, and the notification will be dispatched via a
        task.
        """
        # Deduplicate targets
        # Validate the template & Data
        # Per notification target, find the correct provider
        # If user, get user settings, preferences, fan out to different specified providers
        # Notify via the provider by queueing a task, an outbox with an RPC, etc
        # TODO(Gabe): Figure out if some emails need overrides/specific requirements
        return ""
