from dataclasses import dataclass
from enum import StrEnum

from sentry.integrations.base import IntegrationInstallation
from sentry.users.models.user import User


class NotificationType(StrEnum):
    WeeklyDigests = "weekly_digests"
    Workflows = "workflows"
    IssueAlert = "issue_alert"
    SpikeProtection = "spike_protection"

    # Billing concerns
    BillingEmail = "billing_email"
    ...


# Target Types
type NotificationTarget = NotificationIntegrationTarget | NotificationUserTarget


@dataclass
class NotificationIntegrationTarget:
    # By querying the integration installation, we can get the provider, integration ID, etc.
    integration_installation_id: str
    resource_type: str
    resource_id: str

    @property
    def integration_installation(self) -> IntegrationInstallation:
        return IntegrationInstallation.objects.get(
            id=self.integration_installation_id,
        )


class NotificationUserTarget:
    user_id: str

    @property
    def user(self) -> User:
        return User.objects.get(id=self.user_id)

    def get_user_notification_settings(self): ...
