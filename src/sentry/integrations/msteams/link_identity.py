from abc import ABC
from collections.abc import Mapping
from typing import Any

from django.urls import reverse

from sentry.integrations.messaging import LinkIdentityView, LinkingView, MessagingIntegrationSpec
from sentry.models.integrations import Integration
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign

from ..types import ExternalProviders
from .card_builder.identity import build_linked_card
from .client import MsTeamsClient


def build_linking_url(integration, organization, teams_user_id, team_id, tenant_id):
    signed_params = sign(
        integration_id=integration.id,
        organization_id=organization.id,
        teams_user_id=teams_user_id,
        team_id=team_id,
        tenant_id=tenant_id,
    )

    return absolute_uri(
        reverse("sentry-integration-msteams-link-identity", kwargs={"signed_params": signed_params})
    )


class MsTeamsLinkingView(ABC, LinkingView):
    @property
    def parent_messaging_spec(self) -> MessagingIntegrationSpec:
        from sentry.integrations.msteams import MsTeamsMessagingSpec

        return MsTeamsMessagingSpec()

    @property
    def provider(self) -> ExternalProviders:
        return ExternalProviders.MSTEAMS

    @property
    def user_parameter(self) -> str:
        return "teams_user_id"

    @property
    def expired_link_template(self) -> str:
        return "sentry/integrations/msteams/expired-link.html"


class MsTeamsLinkIdentityView(MsTeamsLinkingView, LinkIdentityView):
    @property
    def success_template(self) -> str:
        return "sentry/integrations/msteams/linked.html"

    def notify_on_success(self, integration: Integration, params: Mapping[str, Any]) -> None:
        card = build_linked_card()
        client = MsTeamsClient(integration)
        user_conversation_id = client.get_user_conversation_id(
            params["teams_user_id"], params["tenant_id"]
        )
        client.send_card(user_conversation_id, card)
