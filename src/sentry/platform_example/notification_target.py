from dataclasses import dataclass
from enum import StrEnum

from sentry.integrations.services.integration.model import RpcIntegration
from sentry.platform_example.notification_provider import ProviderResourceType
from sentry.users.models.user import User


class NotificationType(StrEnum):
    WeeklyDigests = "weekly_digests"
    Workflows = "workflows"
    IssueAlert = "issue_alert"
    SpikeProtection = "spike_protection"
    OrganizationEmailBlast = "organization_email_blast"
    # Billing concerns
    BillingEmail = "billing_email"
    ...

    @staticmethod
    def get_choices() -> list[tuple[str, str]]:
        return [(choice.value, choice.name) for choice in NotificationType]


# Target Types
type NotificationTarget = NotificationIntegrationTarget | NotificationUserTarget


@dataclass
class NotificationIntegrationTarget:
    # By querying the integration installation, we can get the provider, integration ID, etc.
    organization_id: int
    integration_id: int
    resource_type: ProviderResourceType
    resource_id: str

    @property
    def integration_installation(self) -> RpcIntegration:
        raise NotImplementedError("Subclasses must implement this method")


@dataclass
class NotificationUserTarget:
    user_id: int

    @property
    def user(self) -> User:
        return User.objects.get(id=self.user_id)

    def get_user_notification_settings(self): ...
