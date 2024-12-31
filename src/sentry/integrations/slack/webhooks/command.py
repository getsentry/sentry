from __future__ import annotations

import logging

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.helpers.teams import is_team_admin
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.slack.message_builder.disconnected import SlackDisconnectedMessageBuilder
from sentry.integrations.slack.metrics import (
    SLACK_COMMANDS_ENDPOINT_FAILURE_DATADOG_METRIC,
    SLACK_COMMANDS_ENDPOINT_SUCCESS_DATADOG_METRIC,
)
from sentry.integrations.slack.requests.base import SlackDMRequest, SlackRequestError
from sentry.integrations.slack.requests.command import SlackCommandRequest
from sentry.integrations.slack.utils.auth import is_valid_role
from sentry.integrations.slack.views.link_team import build_team_linking_url
from sentry.integrations.slack.views.unlink_team import build_team_unlinking_url
from sentry.integrations.types import ExternalProviders
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.utils import metrics

_logger = logging.getLogger("sentry.integration.slack.bot-commands")

from .base import SlackDMEndpoint

LINK_TEAM_MESSAGE = (
    "Link your Sentry team to this Slack channel! <{associate_url}|Link your team now> to receive "
    "notifications of issues in Sentry in Slack."
)
LINK_USER_FIRST_MESSAGE = (
    "You must first link your identity to Sentry by typing /sentry link. Be aware that you "
    "must be an admin or higher in your Sentry organization or a team admin to link your team."
)
LINK_FROM_CHANNEL_MESSAGE = "You must type this command in a channel, not a DM."
UNLINK_TEAM_MESSAGE = "<{associate_url}|Click here to unlink your team from this channel.>"
TEAM_NOT_LINKED_MESSAGE = "No team is linked to this channel."
DIRECT_MESSAGE_CHANNEL_NAME = "directmessage"
INSUFFICIENT_ROLE_MESSAGE = (
    "You must be a Sentry organization admin/manager/owner or a team admin to link or unlink teams."
)


def is_team_linked_to_channel(organization: Organization, slack_request: SlackDMRequest) -> bool:
    """Check if a Slack channel already has a team linked to it"""
    return ExternalActor.objects.filter(
        organization_id=organization.id,
        integration_id=slack_request.integration.id,
        provider=ExternalProviders.SLACK.value,
        external_name=slack_request.channel_name,
        external_id=slack_request.channel_id,
    ).exists()


@region_silo_endpoint
class SlackCommandsEndpoint(SlackDMEndpoint):
    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = ()
    permission_classes = ()
    slack_request_class = SlackCommandRequest

    _METRICS_SUCCESS_KEY = SLACK_COMMANDS_ENDPOINT_SUCCESS_DATADOG_METRIC
    _METRICS_FAILURE_KEY = SLACK_COMMANDS_ENDPOINT_FAILURE_DATADOG_METRIC

    def reply(self, slack_request: SlackDMRequest, message: str) -> Response:
        return self.respond(
            {
                "response_type": "ephemeral",
                "replace_original": False,
                "text": message,
            }
        )

    def link_team(self, slack_request: SlackDMRequest) -> Response:
        if slack_request.channel_name == DIRECT_MESSAGE_CHANNEL_NAME:
            return self.reply(slack_request, LINK_FROM_CHANNEL_MESSAGE)

        logger_params = {}

        identity_user = slack_request.get_identity_user()
        if not identity_user:
            _logger.info("no-identity-user", extra=logger_params)
            return self.reply(slack_request, LINK_USER_FIRST_MESSAGE)

        integration = slack_request.integration
        logger_params["integration_id"] = integration.id
        organization_memberships = OrganizationMember.objects.get_for_integration(
            integration, identity_user
        )

        has_valid_role = False
        for organization_membership in organization_memberships:
            if is_valid_role(organization_membership) or is_team_admin(organization_membership):
                has_valid_role = True

        if not has_valid_role:
            _logger.error("insufficient-role", extra=logger_params)
            metrics.incr(
                self._METRICS_FAILURE_KEY + ".link_team.insufficient_role", sample_rate=1.0
            )
            return self.reply(slack_request, INSUFFICIENT_ROLE_MESSAGE)

        associate_url = build_team_linking_url(
            integration=integration,
            slack_id=slack_request.user_id,
            channel_id=slack_request.channel_id,
            channel_name=slack_request.channel_name,
            response_url=slack_request.response_url,
        )

        metrics.incr(self._METRICS_SUCCESS_KEY + ".link_team", sample_rate=1.0)
        return self.reply(slack_request, LINK_TEAM_MESSAGE.format(associate_url=associate_url))

    def unlink_team(self, slack_request: SlackDMRequest) -> Response:
        if slack_request.channel_name == DIRECT_MESSAGE_CHANNEL_NAME:
            return self.reply(slack_request, LINK_FROM_CHANNEL_MESSAGE)

        identity_user = slack_request.get_identity_user()
        if not identity_user:
            return self.reply(slack_request, LINK_USER_FIRST_MESSAGE)

        integration = slack_request.integration
        organization_memberships = OrganizationMember.objects.get_for_integration(
            integration, identity_user
        )

        found: OrganizationMember | None = None
        for organization_membership in organization_memberships:
            if is_team_linked_to_channel(organization_membership.organization, slack_request):
                found = organization_membership

        if not found:
            return self.reply(slack_request, TEAM_NOT_LINKED_MESSAGE)

        if not is_valid_role(found) and not is_team_admin(found):
            return self.reply(slack_request, INSUFFICIENT_ROLE_MESSAGE)

        associate_url = build_team_unlinking_url(
            integration=integration,
            organization_id=found.organization.id,
            slack_id=slack_request.user_id,
            channel_id=slack_request.channel_id,
            channel_name=slack_request.channel_name,
            response_url=slack_request.response_url,
        )

        metrics.incr(self._METRICS_SUCCESS_KEY + ".unlink_team", sample_rate=1.0)
        return self.reply(slack_request, UNLINK_TEAM_MESSAGE.format(associate_url=associate_url))

    def post(self, request: Request) -> Response:
        try:
            slack_request = self.slack_request_class(request)
            slack_request.validate()
        except SlackRequestError as e:
            if e.status == status.HTTP_403_FORBIDDEN:
                metrics.incr(
                    self._METRICS_FAILURE_KEY + ".slack-commands-endpoint.forbidden",
                    sample_rate=1.0,
                )
                return self.respond(SlackDisconnectedMessageBuilder().build())
            metrics.incr(
                self._METRICS_FAILURE_KEY + ".slack-commands-endpoint.validation_error",
                sample_rate=1.0,
            )
            return self.respond(status=e.status)

        metrics.incr(self._METRICS_SUCCESS_KEY + ".slack-commands-endpoint", sample_rate=1.0)
        return super().post_dispatcher(slack_request)
