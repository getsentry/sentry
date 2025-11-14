from typing import int
import logging

from sentry.api.utils import generate_region_url
from sentry.integrations.messaging.linkage import UnlinkTeamView
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.slack.views.linkage import SlackLinkageView
from sentry.silo.base import SiloMode
from sentry.web.frontend.base import region_silo_view

from . import build_linking_url as base_build_linking_url

_logger = logging.getLogger(__name__)

INSUFFICIENT_ACCESS = (
    "You must be a Sentry organization admin/manager/owner or a team admin to unlink a team."
)


def build_team_unlinking_url(
    integration: Integration | RpcIntegration,
    organization_id: int,
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
        # The team-linking view is region-specific, so skip the middleware proxy if necessary.
        url_prefix=(
            generate_region_url() if SiloMode.get_current_mode() == SiloMode.REGION else None
        ),
    )


@region_silo_view
class SlackUnlinkTeamView(SlackLinkageView, UnlinkTeamView):
    """
    Django view for unlinking team from slack channel. Deletes from ExternalActor table.
    """
