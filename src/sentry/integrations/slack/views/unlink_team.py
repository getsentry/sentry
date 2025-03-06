import logging

from sentry.integrations.messaging.linkage import UnlinkTeamView
from sentry.integrations.models.integration import Integration
from sentry.integrations.slack.views.linkage import SlackLinkageView
from sentry.web.frontend.base import region_silo_view

from . import build_linking_url as base_build_linking_url

_logger = logging.getLogger(__name__)

INSUFFICIENT_ACCESS = (
    "You must be a Sentry organization admin/manager/owner or a team admin to unlink a team."
)


def build_team_unlinking_url(
    integration: Integration,
    organization_id: str,
    slack_id: str,
    channel_id: str,
    channel_name: str,
    response_url: str,
) -> str:
    return base_build_linking_url(
        "sentry-integration-slack-unlink-team",
        integration_id=integration.id,
        organization_id=organization_id,
        slack_id=slack_id,
        channel_name=channel_name,
        channel_id=channel_id,
        response_url=response_url,
    )


@region_silo_view
class SlackUnlinkTeamView(SlackLinkageView, UnlinkTeamView):
    """
    Django view for unlinking team from slack channel. Deletes from ExternalActor table.
    """
