from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import Any

from django import forms
from django.http import HttpRequest, HttpResponse
from slack_sdk.errors import SlackApiError

from sentry.integrations.messaging.linkage import LinkTeamView
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.slack.metrics import (
    SLACK_LINK_TEAM_MSG_FAILURE_DATADOG_METRIC,
    SLACK_LINK_TEAM_MSG_SUCCESS_DATADOG_METRIC,
)
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.slack.views.linkage import SlackLinkageView
from sentry.models.team import Team
from sentry.utils import metrics
from sentry.web.frontend.base import region_silo_view
from sentry.web.helpers import render_to_response

from . import build_linking_url as base_build_linking_url

ALREADY_LINKED_TITLE = "Already linked"
ALREADY_LINKED_MESSAGE = "The {slug} team has already been linked to a Slack channel."
SUCCESS_LINKED_TITLE = "Team linked"
SUCCESS_LINKED_MESSAGE = "The {slug} team will now receive issue alert{workflow_addon} notifications in the {channel_name} channel."

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
    )


class SelectTeamForm(forms.Form):
    team = forms.ChoiceField(label="Team")

    def __init__(self, teams: Sequence[Team], *args: Any, **kwargs: Any):
        super().__init__(*args, **kwargs)

        team_field = self.fields["team"]
        assert isinstance(team_field, forms.ChoiceField)
        team_field.choices = [(team.id, team.slug) for team in teams]
        team_field.widget.choices = team_field.choices


@region_silo_view
class SlackLinkTeamView(SlackLinkageView, LinkTeamView):
    """
    Django view for linking team to slack channel. Creates an entry on ExternalActor table.
    """

    def notify_on_success(self, channel_id: str, integration: RpcIntegration, message: str) -> None:
        try:
            client = SlackSdkClient(integration_id=integration.id)
            client.chat_postMessage(channel=channel_id, text=message)
            metrics.incr(SLACK_LINK_TEAM_MSG_SUCCESS_DATADOG_METRIC, sample_rate=1.0)
        except SlackApiError:
            # whether or not we send a Slack message, the team was linked successfully
            metrics.incr(SLACK_LINK_TEAM_MSG_FAILURE_DATADOG_METRIC, sample_rate=1.0)

    def notify_team_already_linked(
        self, request: HttpRequest, channel_id: str, integration: RpcIntegration, team: Team
    ) -> HttpResponse:
        message = ALREADY_LINKED_MESSAGE.format(slug=team.slug)
        try:
            client = SlackSdkClient(integration_id=integration.id)
            client.chat_postMessage(channel=channel_id, text=message)
            metrics.incr(SLACK_LINK_TEAM_MSG_SUCCESS_DATADOG_METRIC, sample_rate=1.0)
        except SlackApiError:
            # whether or not we send a Slack message, the team is already linked
            metrics.incr(SLACK_LINK_TEAM_MSG_FAILURE_DATADOG_METRIC, sample_rate=1.0)

        return render_to_response(
            "sentry/integrations/slack/post-linked-team.html",
            request=request,
            context={
                "heading_text": ALREADY_LINKED_TITLE,
                "body_text": message,
                "channel_id": channel_id,
                "team_id": integration.external_id,
            },
        )
