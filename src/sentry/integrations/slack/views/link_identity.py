import logging
from abc import ABC, abstractmethod
from collections.abc import Mapping
from typing import Any

from sentry.integrations.messaging import (
    IdentityLinkageView,
    LinkageView,
    LinkIdentityView,
    MessagingIntegrationSpec,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.slack.utils.notifications import SlackCommand, respond_to_slack_command
from sentry.integrations.types import ExternalProviderEnum, ExternalProviders
from sentry.web.frontend.base import control_silo_view

from . import SALT
from . import build_linking_url as base_build_linking_url

_logger = logging.getLogger(__name__)

SUCCESS_LINKED_MESSAGE = (
    "Your Slack identity has been linked to your Sentry account. You're good to go!"
)


def build_linking_url(
    integration: RpcIntegration, slack_id: str, channel_id: str, response_url: str
) -> str:
    return base_build_linking_url(
        "sentry-integration-slack-link-identity",
        integration_id=integration.id,
        slack_id=slack_id,
        channel_id=channel_id,
        response_url=response_url,
    )


class SlackLinkageView(LinkageView, ABC):
    @property
    def parent_messaging_spec(self) -> MessagingIntegrationSpec:
        from sentry.integrations.slack.spec import SlackMessagingSpec

        return SlackMessagingSpec()

    @property
    def provider(self) -> ExternalProviders:
        return ExternalProviders.SLACK

    @property
    def external_provider_enum(self) -> ExternalProviderEnum:
        return ExternalProviderEnum.SLACK

    @property
    def salt(self) -> str:
        return SALT

    @property
    def external_id_parameter(self) -> str:
        return "slack_id"

    @property
    def expired_link_template(self) -> str:
        return "sentry/integrations/slack/expired-link.html"


class SlackIdentityLinkageView(IdentityLinkageView, ABC):
    def notify_on_success(
        self, external_id: str, params: Mapping[str, Any], integration: Integration | None
    ) -> None:
        respond_to_slack_command(
            self.slack_command, integration, external_id, params.get("response_url")
        )

    @property
    @abstractmethod
    def slack_command(self) -> SlackCommand:
        raise NotImplementedError


@control_silo_view
class SlackLinkIdentityView(SlackIdentityLinkageView, LinkIdentityView):
    """
    Django view for linking user to slack account. Creates an entry on Identity table.
    """

    @property
    def slack_command(self) -> SlackCommand:
        return SlackCommand.LINK

    def get_success_template_and_context(
        self, params: Mapping[str, Any], integration: Integration | None
    ) -> tuple[str, dict[str, Any]]:
        return "sentry/integrations/slack/linked.html", {
            "channel_id": params["channel_id"],
            "team_id": integration.external_id,
        }
