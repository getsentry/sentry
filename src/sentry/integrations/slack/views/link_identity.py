import logging
from collections.abc import Mapping
from typing import Any

from sentry.integrations.messaging.linkage import LinkIdentityView
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.slack.utils.notifications import SlackCommandResponse
from sentry.integrations.slack.views.linkage import SlackIdentityLinkageView
from sentry.web.frontend.base import control_silo_view

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


@control_silo_view
class SlackLinkIdentityView(SlackIdentityLinkageView, LinkIdentityView):
    """
    Django view for linking user to slack account. Creates an entry on Identity table.
    """

    @property
    def command_response(self) -> SlackCommandResponse:
        return SlackCommandResponse("link", SUCCESS_LINKED_MESSAGE, "slack.link-identity")

    def get_success_template_and_context(
        self, params: Mapping[str, Any], integration: Integration | None
    ) -> tuple[str, dict[str, Any]]:
        if integration is None:
            raise ValueError(
                'integration is required for linking (params must include "integration_id")'
            )
        return "sentry/integrations/slack/linked.html", {
            "channel_id": params["channel_id"],
            "team_id": integration.external_id,
        }
