from __future__ import annotations

from typing import TYPE_CHECKING, Any, Mapping, MutableMapping, Sequence

from sentry.notifications.class_manager import register
from sentry.notifications.notifications.organization_request import OrganizationRequestNotification
from sentry.notifications.notifications.strategies.owner_recipient_strategy import (
    OwnerRecipientStrategy,
)
from sentry.notifications.utils.actions import MessageAction
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.types.integrations import ExternalProviders

if TYPE_CHECKING:
    from sentry.models import Organization, User

provider_types = {
    "first_party": "integrations",
    "plugin": "plugins",
    "sentry_app": "sentry-apps",
}


def get_url(organization: Organization, provider_type: str, provider_slug: str) -> str:
    type_name = provider_types.get(provider_type, "")
    return str(
        organization.absolute_url(
            f"/settings/{organization.slug}/{type_name}/{provider_slug}/",
            query="referrer=request_email",
        )
    )


@register()
class IntegrationRequestNotification(OrganizationRequestNotification):
    # TODO: switch to a strategy based on the integration write scope
    RoleBasedRecipientStrategyClass = OwnerRecipientStrategy
    metrics_key = "integration_request"
    template_path = "sentry/emails/requests/organization-integration"

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
            "requester_name": self.requester.get_display_name(),
            "organization_name": self.organization.name,
            "integration_link": self.integration_link,
            "integration_name": self.provider_name,
            "message": self.message,
        }

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return f"Your team member requested the {self.provider_name} integration on Sentry"

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        return self.get_subject()

    def build_attachment_title(self, recipient: RpcActor) -> str:
        return "Request to Install"

    def get_message_description(self, recipient: RpcActor, provider: ExternalProviders) -> str:
        requester_name = self.requester.get_display_name()
        optional_message = (
            f" They've included this message `{self.message}`" if self.message else ""
        )
        return f"{requester_name} is requesting to install the {self.provider_name} integration into {self.organization.name}.{optional_message}"

    def get_message_actions(
        self, recipient: RpcActor, provider: ExternalProviders
    ) -> Sequence[MessageAction]:
        # TODO: update referrer
        return [MessageAction(name="Check it out", url=self.integration_link)]
