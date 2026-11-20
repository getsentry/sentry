from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import Any

from django import forms

from sentry.api.utils import generate_locality_url
from sentry.integrations.messaging.linkage import LinkTeamView
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.slack.views.linkage import SlackLinkageView
from sentry.models.team import Team
from sentry.silo.base import SiloMode
from sentry.web.frontend.base import cell_silo_view

from . import build_linking_url as base_build_linking_url

ALREADY_LINKED_TITLE = "Already linked"
SUCCESS_LINKED_TITLE = "Team linked"

_logger = logging.getLogger(__name__)


def build_team_linking_url(
    integration: Integration | RpcIntegration,
    slack_id: str,
    channel_id: str,
    channel_name: str,
    response_url: str,
) -> str:
    return base_build_linking_url(
        "sentry-integration-slack-link-team",
        integration_id=integration.id,
        slack_id=slack_id,
        channel_id=channel_id,
        channel_name=channel_name,
        response_url=response_url,
        # TODO(cells): This is broken for a multi-cell locality as the router cannot identify
        # the correct cell silo for routing. The endpoint should be moved to the control silo.
        url_prefix=(
            generate_locality_url() if SiloMode.get_current_mode() == SiloMode.CELL else None
        ),
    )


class SelectTeamForm(forms.Form):
    team = forms.ChoiceField(label="Team")

    def __init__(self, teams: Sequence[Team], *args: Any, **kwargs: Any):
        super().__init__(*args, **kwargs)

        team_field = self.fields["team"]
        assert isinstance(team_field, forms.ChoiceField)
        team_field.choices = [(team.id, team.slug) for team in teams]
        team_field.widget.choices = team_field.choices


@cell_silo_view
class SlackLinkTeamView(SlackLinkageView, LinkTeamView):
    """
    Django view for linking team to slack channel. Creates an entry on ExternalActor table.
    """
