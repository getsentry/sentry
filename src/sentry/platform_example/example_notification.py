from sentry.models.organization import Organization
from sentry.platform_example.notification import NotificationService, NotificationTemplate
from sentry.platform_example.notification_target import (
    NotificationOrganizationTargetStrategy,
    NotificationSource,
)


def notify_all_sentry_members():
    organization_id = Organization.objects.get(slug="sentry").id

    strategy = NotificationOrganizationTargetStrategy(organization_id=organization_id)
    NotificationService.notify(
        target_strategy=strategy,
        template=NotificationTemplate(template_data={}),
        data={"message": "Hello, world!"},
        notification_type=NotificationSource.OrganizationEmailBlast,
    )
