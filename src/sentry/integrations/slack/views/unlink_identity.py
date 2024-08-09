import logging
from collections.abc import Mapping
from typing import Any

from sentry.integrations.messaging import UnlinkIdentityView
from sentry.integrations.slack.utils.notifications import SlackCommand
from sentry.integrations.slack.views import build_linking_url as base_build_linking_url
from sentry.integrations.slack.views.link_identity import SlackLinkingView
from sentry.models.integrations import Integration
from sentry.web.frontend.base import control_silo_view

SUCCESS_UNLINKED_MESSAGE = "Your Slack identity has been unlinked from your Sentry account."

_logger = logging.getLogger(__name__)


def build_unlinking_url(
    integration_id: int, slack_id: str, channel_id: str, response_url: str
) -> str:
    return base_build_linking_url(
        "sentry-integration-slack-unlink-identity",
        integration_id=integration_id,
        slack_id=slack_id,
        channel_id=channel_id,
        response_url=response_url,
    )


@control_silo_view
class SlackUnlinkIdentityView(SlackLinkingView, UnlinkIdentityView):
    """
    Django view for unlinking user from slack account. Deletes from Identity table.
    """

    @property
    def slack_command(self) -> SlackCommand:
        return SlackCommand.UNLINK

    def get_success_template_and_context(
        self, integration: Integration, params: Mapping[str, Any]
    ) -> tuple[str, dict[str, Any]]:
        return "sentry/integrations/slack/unlinked.html", {
            "channel_id": params["channel_id"],
            "team_id": integration.external_id,
        }
