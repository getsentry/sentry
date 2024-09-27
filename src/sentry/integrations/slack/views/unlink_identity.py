import logging
from collections.abc import Mapping
from typing import Any

from sentry.integrations.messaging.linkage import UnlinkIdentityView
from sentry.integrations.models.integration import Integration
from sentry.integrations.slack.utils.notifications import SlackCommandResponse
from sentry.integrations.slack.views import build_linking_url as base_build_linking_url
from sentry.integrations.slack.views.linkage import SlackIdentityLinkageView
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
class SlackUnlinkIdentityView(SlackIdentityLinkageView, UnlinkIdentityView):
    """
    Django view for unlinking user from slack account. Deletes from Identity table.
    """

    @property
    def command_response(self) -> SlackCommandResponse:
        return SlackCommandResponse("unlink", SUCCESS_UNLINKED_MESSAGE, "slack.unlink-identity")

    def get_success_template_and_context(
        self, params: Mapping[str, Any], integration: Integration | None
    ) -> tuple[str, dict[str, Any]]:
        if integration is None:
            raise ValueError
        context = {"channel_id": params["channel_id"], "team_id": integration.external_id}
        return "sentry/integrations/slack/unlinked.html", context
