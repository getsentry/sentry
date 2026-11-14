from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import Any

from django import forms
from django.http import HttpRequest
from django.http.response import HttpResponseBase
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache

from sentry import options
from sentry.api.utils import generate_locality_url
from sentry.integrations.messaging.linkage import LinkTeamView
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.slack.views.linkage import SlackLinkageView
from sentry.models.team import Team
from sentry.silo.base import SiloMode
from sentry.web.frontend.base import all_silo_view
from sentry.web.frontend.react_page import ReactMixin

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
        url_prefix=_team_linking_url_prefix(),
    )


def _team_linking_url_prefix() -> str | None:
    # The React page finds each organization's cell itself, so it is served
    # from the primary domain.
    if options.get("slack.link-team-react-enabled"):
        return None

    # TODO(cells): This is broken for a multi-cell locality as the router cannot identify
    # the correct cell silo for routing.
    if SiloMode.get_current_mode() == SiloMode.CELL:
        return generate_locality_url()

    return None


class SelectTeamForm(forms.Form):
    team = forms.ChoiceField(label="Team")

    def __init__(self, teams: Sequence[Team], *args: Any, **kwargs: Any):
        super().__init__(*args, **kwargs)

        team_field = self.fields["team"]
        assert isinstance(team_field, forms.ChoiceField)
        team_field.choices = [(team.id, team.slug) for team in teams]
        team_field.widget.choices = team_field.choices


@all_silo_view
class SlackLinkTeamView(SlackLinkageView, LinkTeamView, ReactMixin):
    """
    Django view for linking team to slack channel. Creates an entry on ExternalActor table.

    With `slack.link-team-react-enabled`, GET serves the React page from the
    control silo. Everything else still runs in the cell.
    """

    @method_decorator(never_cache)
    def handle(self, request: HttpRequest, signed_params: str) -> HttpResponseBase:
        # The Slack request parser only sends GET requests for the React page
        # to control, after checking the option itself.
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            if request.method != "GET":
                return self.render_error_page(request, status=404, body_text="HTTP 404: Not found")
            return self.handle_react(request)

        if is_react_team_link_request(request):
            return self.handle_react(request)

        return super().handle(request, signed_params)


def is_react_team_link_request(request: HttpRequest) -> bool:
    return request.method == "GET" and options.get("slack.link-team-react-enabled")
