from __future__ import annotations

from typing import TYPE_CHECKING, Any, Iterable, Mapping, MutableMapping, Sequence

from sentry import analytics
from sentry.notifications.notifications.organization_request import OrganizationRequestNotification
from sentry.notifications.utils.actions import MessageAction
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri

if TYPE_CHECKING:
    from sentry.models import Organization, Team, User


def get_url(organization: Organization, provider_type: str, provider_slug: str) -> str:
    # Explicitly typing to satisfy mypy.
    url: str = absolute_uri(
        "/".join(
            [
                "/settings",
                organization.slug,
                {
                    "first_party": "integrations",
                    "plugin": "plugins",
                    "sentry_app": "sentry-apps",
                }.get(provider_type, ""),
                provider_slug,
                "?referrer=request_email",
            ]
        )
    )
    return url


class IntegrationRequestNotification(OrganizationRequestNotification):
    category = "integration_request"
    filename = "requests/organization-integration"
    type = "organization.integration.request"

    def __init__(
        self,
        organization: Organization,
        requester: User,
        provider_type: str,
        provider_slug: str,
        provider_name: str,
        message: str | None = None,
    ) -> None:
        super().__init__(organization, requester)
        self.provider_type = provider_type
        self.provider_slug = provider_slug
        self.provider_name = provider_name
        self.message = message
        self.integration_link = get_url(
            self.organization,
            self.provider_type,
            self.provider_slug,
        )

    def get_context(self) -> MutableMapping[str, Any]:
        return {
            **self.get_base_context(),
            "integration_link": self.integration_link,
            "integration_name": self.provider_name,
            "message": self.message,
        }

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return f"Your team member requested the {self.provider_name} integration on Sentry"

    def get_notification_title(self) -> str:
        return self.get_subject()

    def build_attachment_title(self) -> str:
        return "Request to Install"

    def get_message_description(self) -> str:
        requester_name = self.requester.get_display_name()
        optional_message = (
            f" They've included this message `{self.message}`" if self.message else ""
        )
        return f"{requester_name} is requesting to install the {self.provider_name} integration into {self.organization.name}.{optional_message}"

    def get_message_actions(self) -> Sequence[MessageAction]:
        return [MessageAction(name="Check it out", url=self.integration_link)]

    def determine_recipients(self) -> Iterable[Team | User]:
        # Explicitly typing to satisfy mypy.
        recipients: Iterable[Team | User] = self.organization.get_owners()
        return recipients

    def record_notification_sent(
        self, recipient: Team | User, provider: ExternalProviders, **kwargs: Any
    ) -> None:
        # TODO: refactor since this is identical to ProjectNotification.record_notification_sent
        analytics.record(
            f"integrations.{provider.name}.notification_sent",
            category=self.get_category(),
            **self.get_log_params(recipient),
            **kwargs,
        )
