from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import asdict
from typing import Any

from django import forms
from django.core.signing import BadSignature, SignatureExpired
from django.http.response import HttpResponseBase
from django.utils.decorators import method_decorator
from rest_framework.request import Request
from slack_sdk.errors import SlackApiError

from sentry import analytics, features
from sentry.identity.services.identity import identity_service
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.integrations.slack.metrics import (
    SLACK_BOT_COMMAND_LINK_TEAM_FAILURE_DATADOG_METRIC,
    SLACK_BOT_COMMAND_LINK_TEAM_SUCCESS_DATADOG_METRIC,
    SLACK_LINK_TEAM_MSG_FAILURE_DATADOG_METRIC,
    SLACK_LINK_TEAM_MSG_SUCCESS_DATADOG_METRIC,
)
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.slack.utils.auth import is_valid_role
from sentry.integrations.slack.views.types import TeamLinkRequest
from sentry.integrations.types import ExternalProviderEnum, ExternalProviders
from sentry.models.organizationmember import OrganizationMember
from sentry.models.team import Team
from sentry.notifications.services import notifications_service
from sentry.notifications.types import NotificationSettingEnum
from sentry.utils import metrics
from sentry.utils.signing import unsign
from sentry.web.frontend.base import BaseView, region_silo_view
from sentry.web.helpers import render_to_response

from . import SALT
from . import build_linking_url as base_build_linking_url
from . import never_cache, render_error_page

ALLOWED_METHODS = ["GET", "POST"]

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

        self.fields["team"].choices = [(team.id, team.slug) for team in teams]
        self.fields["team"].widget.choices = self.fields["team"].choices


@region_silo_view
class SlackLinkTeamView(BaseView):
    """
    Django view for linking team to slack channel. Creates an entry on ExternalActor table.
    """

    _METRICS_SUCCESS_KEY = SLACK_BOT_COMMAND_LINK_TEAM_SUCCESS_DATADOG_METRIC
    _METRICS_FAILURE_KEY = SLACK_BOT_COMMAND_LINK_TEAM_FAILURE_DATADOG_METRIC

    @method_decorator(never_cache)
    def handle(self, request: Request, signed_params: str) -> HttpResponseBase:
        if request.method not in ALLOWED_METHODS:
            return render_error_page(request, status=405, body_text="HTTP 405: Method not allowed")

        try:
            converted = unsign(signed_params, salt=SALT)
            link_team_request = TeamLinkRequest(**converted)
        except (SignatureExpired, BadSignature) as e:
            _logger.warning("handle.signature_error", exc_info=e)
            metrics.incr(self._METRICS_FAILURE_KEY, tags={"error": str(e)}, sample_rate=1.0)
            return render_to_response(
                "sentry/integrations/slack/expired-link.html",
                status=400,
                request=request,
            )

        logger_params = asdict(link_team_request)
        logger_params["user_id"] = request.user.id

        integration = integration_service.get_integration(
            integration_id=link_team_request.integration_id
        )
        if integration is None:
            _logger.info("integration.not_found", extra=logger_params)
            metrics.incr(self._METRICS_FAILURE_KEY + ".get_integration", sample_rate=1.0)
            return render_error_page(
                request, status=404, body_text="HTTP 404: Could not find the Slack integration."
            )

        organization_memberships = OrganizationMember.objects.get_for_integration(
            integration, request.user
        )
        # Filter to teams where we have write access to, either through having a sufficient
        # organization role (owner/manager/admin) or by being a team admin on at least one team.
        teams_by_id = {}
        for org_membership in organization_memberships:
            for team in Team.objects.get_for_user(
                org_membership.organization,
                request.user,
                # Setting is_team_admin to True only returns teams that member is team admin on.
                # We only want to filter for this when the user does not have a sufficient
                # role in the org, which is checked using is_valid_role.
                is_team_admin=not is_valid_role(org_membership),
            ):
                teams_by_id[team.id] = team

        if not teams_by_id:
            _logger.info("team.no_teams_found", extra=logger_params)
            metrics.incr(self._METRICS_FAILURE_KEY + ".get_teams", sample_rate=1.0)
            return render_error_page(
                request,
                status=404,
                body_text="HTTP 404: No teams found in your organizations to link. You must be a Sentry organization admin/manager/owner or a team admin to link a team in your respective organization.",
            )

        channel_name = link_team_request.channel_name
        channel_id = link_team_request.channel_id
        form = SelectTeamForm(list(teams_by_id.values()), request.POST or None)

        if request.method == "GET":
            return self.respond(
                "sentry/integrations/slack/link-team.html",
                {
                    "form": form,
                    "teams": teams_by_id.values(),
                    "channel_name": channel_name,
                    "provider": integration.get_provider(),
                },
            )

        if not form.is_valid():
            _logger.info("form.invalid", extra={**logger_params, "form_errors": form.errors})
            metrics.incr(self._METRICS_FAILURE_KEY + ".form_invalid", sample_rate=1.0)
            return render_error_page(request, status=400, body_text="HTTP 400: Bad request")

        team_id = int(form.cleaned_data["team"])
        team = teams_by_id.get(team_id)
        if not team:
            _logger.info("team.not_found", extra={"team_id": team_id})
            metrics.incr(self._METRICS_FAILURE_KEY + ".team_not_found", sample_rate=1.0)
            return render_error_page(
                request,
                status=404,
                body_text="HTTP 404: Team does not exist or you do not have sufficient permission to link a team",
            )

        logger_params["team_id"] = team.id

        idp = identity_service.get_provider(
            provider_type="slack", provider_ext_id=integration.external_id
        )
        logger_params["provider_ext_id"] = integration.external_id
        if idp is None:
            _logger.info("identity_provider.not_found", extra=logger_params)
            metrics.incr(
                self._METRICS_FAILURE_KEY + ".identity_provider_not_found", sample_rate=1.0
            )
            return render_error_page(request, status=403, body_text="HTTP 403: Invalid team ID")

        ident = identity_service.get_identity(
            filter={"provider_id": idp.id, "identity_ext_id": link_team_request.slack_id}
        )
        if not ident:
            _logger.info("identity.not_found", extra=logger_params)
            metrics.incr(self._METRICS_FAILURE_KEY + ".identity_not_found", sample_rate=1.0)
            return render_error_page(
                request, status=403, body_text="HTTP 403: User identity does not exist"
            )

        _, created = ExternalActor.objects.get_or_create(
            team_id=team.id,
            organization=team.organization,
            integration_id=integration.id,
            provider=ExternalProviders.SLACK.value,
            defaults=dict(
                external_name=channel_name,
                external_id=channel_id,
            ),
        )

        analytics.record(
            "integrations.identity_linked",
            provider="slack",
            actor_id=team.id,
            actor_type="team",
        )

        if not created:
            message = ALREADY_LINKED_MESSAGE.format(slug=team.slug)
            metrics.incr(self._METRICS_FAILURE_KEY + ".team_already_linked", sample_rate=1.0)

            try:
                client = SlackSdkClient(integration_id=integration.id)
                client.chat_postMessage(channel=channel_id, text=message)
                metrics.incr(SLACK_LINK_TEAM_MSG_SUCCESS_DATADOG_METRIC, sample_rate=1.0)
            except SlackApiError:
                # whether or not we send a Slack message, the team is already linked
                metrics.incr(SLACK_LINK_TEAM_MSG_FAILURE_DATADOG_METRIC, sample_rate=1.0)
                pass

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

        has_team_workflow = features.has(
            "organizations:team-workflow-notifications", team.organization
        )
        # Turn on notifications for all of a team's projects.
        # TODO(jangjodi): Remove this once the flag is removed
        if not has_team_workflow:
            notifications_service.enable_all_settings_for_provider(
                external_provider=ExternalProviderEnum.SLACK,
                team_id=team.id,
                types=[NotificationSettingEnum.ISSUE_ALERTS],
            )

        message = SUCCESS_LINKED_MESSAGE.format(
            slug=team.slug,
            workflow_addon=" and workflow" if has_team_workflow else "",
            channel_name=channel_name,
        )

        try:
            client = SlackSdkClient(integration_id=integration.id)
            client.chat_postMessage(channel=channel_id, text=message)
            metrics.incr(SLACK_LINK_TEAM_MSG_SUCCESS_DATADOG_METRIC, sample_rate=1.0)
        except SlackApiError:
            # whether or not we send a Slack message, the team was linked successfully
            metrics.incr(SLACK_LINK_TEAM_MSG_FAILURE_DATADOG_METRIC, sample_rate=1.0)
            pass

        metrics.incr(self._METRICS_SUCCESS_KEY + ".link_team", sample_rate=1.0)

        return render_to_response(
            "sentry/integrations/slack/post-linked-team.html",
            request=request,
            context={
                "heading_text": SUCCESS_LINKED_TITLE,
                "body_text": message,
                "channel_id": channel_id,
                "team_id": integration.external_id,
            },
        )
