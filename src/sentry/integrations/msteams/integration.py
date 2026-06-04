from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any, TypedDict

from django.core.signing import BadSignature, SignatureExpired
from django.http.request import HttpRequest
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework.fields import CharField

from sentry import options
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
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
from sentry.integrations.msteams.constants import SALT
from sentry.integrations.msteams.metrics import translate_msteams_api_error
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.platform.provider import (
    IntegrationNotificationClient,
    ProviderThreadingContext,
)
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.pipeline.types import PipelineStepResult
from sentry.pipeline.views.base import ApiPipelineSteps, PipelineView
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.signing import unsign

from .card_builder.installation import (
    build_personal_installation_confirmation_message,
    build_team_installation_confirmation_message,
)
from .client import MsTeamsClient, get_token_data

# 24 hours to finish installation
INSTALL_EXPIRATION_TIME = 60 * 60 * 24

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

    def send_notification_with_threading(
        self,
        target: IntegrationNotificationTarget,
        payload: AdaptiveCard,
        threading_context: ProviderThreadingContext,
    ) -> dict[str, Any]:
        raise NotImplementedError("Threading is not supported for Microsoft Teams")


class MsTeamsInstallParams(TypedDict):
    """The payload the Sentry-Teams bot signs into `signed_params`."""

    external_id: str
    external_name: str
    service_url: str
    user_id: str
    conversation_id: str
    tenant_id: str
    installation_type: str


class MsTeamsInitialDataSerializer(CamelSnakeSerializer):
    """Initial pipeline data for Microsoft Teams installs.

    The Sentry bot in Teams renders a card with a single `signed_params` blob
    (see MsTeamsInstallParams). We unsign it here so each field is bound to
    top-level pipeline state individually.
    """

    signed_params = CharField(required=True)

    def validate(self, attrs: dict[str, Any]) -> MsTeamsInstallParams:
        try:
            return unsign(attrs["signed_params"], max_age=INSTALL_EXPIRATION_TIME, salt=SALT)
        except SignatureExpired:
            raise serializers.ValidationError("Installation link expired")
        except BadSignature:
            raise serializers.ValidationError("Invalid installation link")


class MsTeamsAdvanceSerializer(CamelSnakeSerializer):
    state = CharField(required=True)


class MsTeamsApiStep:
    """Install step for Microsoft Teams.

    All install data arrives bound to pipeline state via initialData, so this
    step has no UI of its own. It signals the frontend to auto-advance, which
    triggers `build_integration` to run on the already-bound state.
    """

    step_name = "msteams_install"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, Any]:
        return {
            "appDirectoryInstall": True,
            "state": pipeline.signature,
        }

    def get_serializer_cls(self) -> type:
        return MsTeamsAdvanceSerializer

    def handle_post(
        self,
        validated_data: dict[str, str],
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        if validated_data["state"] != pipeline.signature:
            return PipelineStepResult.error("An error occurred while validating your request.")
        return PipelineStepResult.advance()


class MsTeamsIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.MSTEAMS.value
    name = "Microsoft Teams"
    can_add = False
    can_add_externally = True
    metadata = metadata
    integration_cls = MsTeamsIntegration
    features = frozenset([IntegrationFeatures.CHAT_UNFURL, IntegrationFeatures.ALERT_RULE])

    def get_pipeline_views(self) -> list[PipelineView[IntegrationPipeline]]:
        return []

    def get_pipeline_api_steps(self) -> ApiPipelineSteps[IntegrationPipeline]:
        return [MsTeamsApiStep()]

    def get_initial_data_serializer_cls(self) -> type[MsTeamsInitialDataSerializer]:
        return MsTeamsInitialDataSerializer

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        external_id = state["external_id"]
        external_name = state["external_name"]
        service_url = state["service_url"]
        user_id = state["user_id"]
        conversation_id = state["conversation_id"]

        # TODO: add try/except for request errors
        token_data = get_token_data()

        return {
            "name": external_name,
            "external_id": external_id,
            "metadata": {
                "access_token": token_data["access_token"],
                "expires_at": token_data["expires_at"],
                "service_url": service_url,
                "installation_type": state["installation_type"],
                "tenant_id": state["tenant_id"],
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
