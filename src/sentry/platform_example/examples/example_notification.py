from dataclasses import dataclass

from sentry.models.organization import Organization
from sentry.platform_example.notification import NotificationService
from sentry.platform_example.notification_target_strategies import (
    NotificationOrganizationTargetStrategy,
)
from sentry.platform_example.notification_types import NotificationType
from sentry.platform_example.template_base import (
    DjangoNotificationTemplate,
    EmailTemplate,
    IntegrationTemplate,
    TemplateData,
)


@dataclass
class ExampleNotificationData(TemplateData):
    message: str


ExampleNotificationTemplate = DjangoNotificationTemplate[ExampleNotificationData](
    notification_type=NotificationType.OrganizationEmailBlast,
    email_template=EmailTemplate(
        body_template_path="sentry/emails/organization-email-blast.html",
        subject_template_path="sentry/emails/organization-email-blast.txt",
    ),
    integration_template=IntegrationTemplate(
        body_template_path="sentry/emails/organization-email-blast.txt",
        subject_template_path="sentry/emails/organization-email-blast.txt",
    ),
)


def notify_all_sentry_members():
    organization_id = Organization.objects.get(slug="sentry").id
    strategy = NotificationOrganizationTargetStrategy(organization_id=organization_id)
    targets = strategy.get_targets()

    NotificationService.notify_many(
        targets=targets,
        template=ExampleNotificationTemplate,
        data=ExampleNotificationData(message="Notification Test"),
    )
