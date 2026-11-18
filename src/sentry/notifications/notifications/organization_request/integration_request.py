from __future__ import annotations

from collections.abc import Mapping, MutableMapping, Sequence
from typing import TYPE_CHECKING, Any
from urllib.parse import quote, urlencode

from sentry.integrations.types import ExternalProviders
from sentry.notifications.class_manager import register
from sentry.notifications.notifications.organization_request import OrganizationRequestNotification
from sentry.notifications.notifications.strategies.owner_recipient_strategy import (
    OwnerRecipientStrategy,
)
from sentry.notifications.utils.actions import MessageAction
from sentry.types.actor import Actor
from sentry.utils.email.sanitize import sanitize_outbound_name

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.users.models.user import User

provider_types = {
    "first_party": "integrations",
    "plugin": "plugins",
    "sentry_app": "sentry-apps",
}

# A request can name a category of the integrations directory instead of one provider, with
# provider type "category" and the category as the slug, when any integration in it would do.
CATEGORY_PROVIDER_TYPE = "category"
# The categories a request can name, each with how the email says what was requested.
REQUESTABLE_CATEGORIES: Mapping[str, str] = {
    "source code management": "a source code management integration",
}


def get_url(
    organization: Organization, provider_type: str | None, provider_slug: str | None
) -> str:
    if provider_slug is None or provider_type == CATEGORY_PROVIDER_TYPE:
        query = {"referrer": "request_email"}
        if provider_slug is not None:
            query = {"category": provider_slug, **query}
        return str(
            organization.absolute_url(
                f"/settings/{organization.slug}/integrations/",
                query=urlencode(query, quote_via=quote),
            )
        )
    type_name = provider_types.get(provider_type or "", "")
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
        provider_type: str | None,
        provider_slug: str | None,
        provider_name: str | None,
        message: str | None = None,
    ) -> None:
        """With no provider, the request is for any integration. With a category as the provider
        (`CATEGORY_PROVIDER_TYPE`), it's for any integration in that category."""
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

    def _is_one_provider(self) -> bool:
        return self.provider_name is not None and self.provider_type != CATEGORY_PROVIDER_TYPE

    def _requested(self) -> str:
        """What was requested, for the middle of a sentence."""
        if self._is_one_provider():
            return f"the {sanitize_outbound_name(self.provider_name or '')} integration"
        if self.provider_type == CATEGORY_PROVIDER_TYPE and self.provider_slug:
            return REQUESTABLE_CATEGORIES.get(self.provider_slug, "an integration")
        return "an integration"

    def get_context(self) -> MutableMapping[str, Any]:
        return {
            **self.get_base_context(),
            "requester_name": self.requester.get_display_name(),
            "organization_name": self.organization.name,
            "integration_link": self.integration_link,
            "requested": (
                f"the installation of {self.provider_name}"
                if self._is_one_provider()
                else self._requested()
            ),
            "install_label": (
                f"Install {self.provider_name}"
                if self._is_one_provider()
                else "Install integration"
            ),
            "message": self.message,
        }

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        return f"Your team member requested {self._requested()} on Sentry"

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        return self.get_subject()

    def build_attachment_title(self, recipient: Actor) -> str:
        return "Request to Install"

    def get_message_description(self, recipient: Actor, provider: ExternalProviders) -> str:
        requester_name = sanitize_outbound_name(self.requester.get_display_name())
        optional_message = (
            f" They've included this message `{sanitize_outbound_name(self.message)}`"
            if self.message
            else ""
        )
        return f"{requester_name} is requesting to install {self._requested()} into {sanitize_outbound_name(self.organization.name)}.{optional_message}"

    def get_message_actions(
        self, recipient: Actor, provider: ExternalProviders
    ) -> Sequence[MessageAction]:
        # TODO: update referrer
        return [MessageAction(name="Check it out", url=self.integration_link)]
