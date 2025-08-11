from collections.abc import Mapping
from typing import Any

from django.urls import reverse

from sentry.integrations.messaging.linkage import LinkIdentityView
from sentry.integrations.models.integration import Integration
from sentry.integrations.msteams.linkage import MsTeamsIdentityLinkageView
from sentry.integrations.services.integration import RpcIntegration
from sentry.models.organization import Organization
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign

from .card_builder.identity import build_linked_card
from .client import MsTeamsClient


def build_linking_url(
    integration: Integration | RpcIntegration,
    organization: Organization,
    teams_user_id: str,
    team_id: str,
    tenant_id: str,
) -> str:
    from sentry.integrations.msteams.constants import SALT

    signed_params = sign(
        salt=SALT,
        integration_id=integration.id,
        organization_id=organization.id,
        teams_user_id=teams_user_id,
        team_id=team_id,
        tenant_id=tenant_id,
    )

    return absolute_uri(
        reverse("sentry-integration-msteams-link-identity", kwargs={"signed_params": signed_params})
    )


class MsTeamsLinkIdentityView(MsTeamsIdentityLinkageView, LinkIdentityView):
    def get_success_template_and_context(
        self, params: Mapping[str, Any], integration: Integration | None
    ) -> tuple[str, dict[str, Any]]:
        return "sentry/integrations/msteams/linked.html", {}

    def notify_on_success(
        self, external_id: str, params: Mapping[str, Any], integration: Integration | None
    ) -> None:
        if integration is None:
            raise ValueError(
                'Integration is required for linking (params must include "integration_id")'
            )
        card = build_linked_card()
        client = MsTeamsClient(integration)
        user_conversation_id = client.get_user_conversation_id(external_id, params["tenant_id"])
        client.send_card(user_conversation_id, card)
