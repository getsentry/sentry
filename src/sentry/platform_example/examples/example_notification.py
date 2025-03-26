from dataclasses import dataclass
from typing import Any

from sentry.models.organization import Organization
from sentry.platform_example.notification import (
    NotificationData,
    NotificationService,
    NotificationTemplate,
)
from sentry.platform_example.notification_target import NotificationType
from sentry.platform_example.notification_target_strategies import (
    NotificationOrganizationTargetStrategy,
)


@dataclass
class ExampleNotificationData(NotificationData):
    message: str


@dataclass
class ExampleNotificationTemplate(NotificationTemplate[ExampleNotificationData]):
    template_data: dict[str, Any] = {}
    notification_type: NotificationType = NotificationType.OrganizationEmailBlast


def notify_all_sentry_members():
    organization_id = Organization.objects.get(slug="sentry").id
    strategy = NotificationOrganizationTargetStrategy(organization_id=organization_id)
    targets = strategy.get_targets()

    NotificationService.notify_many(
        targets=targets,
        template=ExampleNotificationTemplate(),
        data=ExampleNotificationData(message="Notification Test"),
    )
