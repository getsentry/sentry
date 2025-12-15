from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.utils.translation import gettext_lazy as _

from sentry import options
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.msteams.card_builder.block import AdaptiveCard
from sentry.integrations.msteams.metrics import translate_msteams_api_error
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.platform.provider import IntegrationNotificationClient
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.pipeline.views.base import PipelineView
from sentry.shared_integrations.exceptions import ApiError

from .card_builder.installation import (
    build_personal_installation_confirmation_message,
    build_team_installation_confirmation_message,
)
from .client import MsTeamsClient, get_token_data

logger = logging.getLogger("sentry.integrations.msteams")

DESCRIPTION = (
    "Microsoft Teams is a hub for teamwork in Office 365. Keep all your team's chats, meetings, files, and apps together in one place."
    "\n\nGet [alerts](https://docs.sentry.io/product/alerts-notifications/alerts/) that let you assign, ignore, and resolve issues"
    " right in your Teams channels with the Sentry integration for Microsoft Teams."
)


FEATURES = [
    FeatureDescription(
        """
        Interact with messages in the chat to assign, ignore, and resolve issues.
        """,
        IntegrationFeatures.CHAT_UNFURL,  # not actually using unfurl but we show this as just "chat"
    ),
    FeatureDescription(
        "Configure rule based Teams alerts to automatically be posted into a specific channel or user.",
        IntegrationFeatures.ALERT_RULE,
    ),
]


INSTALL_NOTICE_TEXT = (
    "Visit the Teams Marketplace to install this integration. After adding the integration"
    " to your team, you will get a welcome message in the General channel to complete installation."
)

external_install = {
    "url": "https://teams.microsoft.com/l/app/{}".format(options.get("msteams.app-id")),
    "buttonText": _("Teams Marketplace"),
    "noticeText": _(INSTALL_NOTICE_TEXT),
}


metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Microsoft%20Teams%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/msteams",
    aspects={"externalInstall": external_install},
)


class MsTeamsIntegration(IntegrationInstallation, IntegrationNotificationClient):
    def get_client(self) -> MsTeamsClient:
        return MsTeamsClient(self.model)

    def send_notification(
        self, target: IntegrationNotificationTarget, payload: AdaptiveCard
    ) -> None:
        client = self.get_client()
        try:
            client.send_card(conversation_id=target.resource_id, card=payload)
        except ApiError as e:
            translate_msteams_api_error(e)


class MsTeamsIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.MSTEAMS.value
    name = "Microsoft Teams"
    can_add = False
    metadata = metadata
    integration_cls = MsTeamsIntegration
    features = frozenset([IntegrationFeatures.CHAT_UNFURL, IntegrationFeatures.ALERT_RULE])

    def get_pipeline_views(self) -> Sequence[PipelineView[IntegrationPipeline]]:
        return [MsTeamsPipelineView()]

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        data = state[self.key]
        external_id = data["external_id"]
        external_name = data["external_name"]
        service_url = data["service_url"]
        user_id = data["user_id"]
        conversation_id = data["conversation_id"]

        # TODO: add try/except for request errors
        token_data = get_token_data()

        return {
            "name": external_name,
            "external_id": external_id,
            "metadata": {
                "access_token": token_data["access_token"],
                "expires_at": token_data["expires_at"],
                "service_url": service_url,
                "installation_type": data["installation_type"],
                "tenant_id": data["tenant_id"],
            },
            "user_identity": {
                "type": IntegrationProviderSlug.MSTEAMS.value,
                "external_id": user_id,
                "scopes": [],
                "data": {},
            },
            "post_install_data": {"conversation_id": conversation_id},
        }

    def post_install(
        self,
        integration: Integration,
        organization: RpcOrganization,
        *,
        extra: dict[str, Any],
    ) -> None:
        client = MsTeamsClient(integration)
        card = (
            build_team_installation_confirmation_message(organization)
            if "team" == integration.metadata["installation_type"]
            else build_personal_installation_confirmation_message()
        )
        conversation_id = extra["conversation_id"]
        client.send_card(conversation_id, card)


class MsTeamsPipelineView:
    def dispatch(self, request: HttpRequest, pipeline: IntegrationPipeline) -> HttpResponseBase:
        return pipeline.next_step()
