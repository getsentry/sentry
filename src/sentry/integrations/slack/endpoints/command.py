from typing import Optional, Sequence, Tuple

from django.http import HttpResponse
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.integrations.slack.message_builder.disconnected import SlackDisconnectedMessageBuilder
from sentry.integrations.slack.requests.base import SlackRequest, SlackRequestError
from sentry.integrations.slack.requests.command import SlackCommandRequest
from sentry.integrations.slack.views.link_team import build_team_linking_url
from sentry.integrations.slack.views.unlink_team import build_team_unlinking_url
from sentry.models import (
    ExternalActor,
    Identity,
    IdentityProvider,
    Organization,
    OrganizationMember,
)
from sentry.types.integrations import ExternalProviders

from .base import SlackDMEndpoint

LINK_TEAM_MESSAGE = (
    "Link your Sentry team to this Slack channel! <{associate_url}|Link your team now> to receive "
    "notifications of issues in Sentry in Slack."
)
CHANNEL_ALREADY_LINKED_MESSAGE = "This channel already has a team linked to it."
LINK_USER_FIRST_MESSAGE = (
    "You must first link your identity to Sentry by typing /sentry link. Be aware that you "
    "must be an admin or higher in your Sentry organization to link your team."
)
LINK_FROM_CHANNEL_MESSAGE = "You must type this command in a channel, not a DM."
UNLINK_TEAM_MESSAGE = "<{associate_url}|Click here to unlink your team from this channel.>"
TEAM_NOT_LINKED_MESSAGE = "No team is linked to this channel."
DIRECT_MESSAGE_CHANNEL_NAME = "directmessage"
INSUFFICIENT_ROLE_MESSAGE = "You must be a Sentry admin, manager, or owner to link or unlink teams."
ALLOWED_ROLES = ["admin", "manager", "owner"]


def is_valid_role(org_member: OrganizationMember) -> bool:
    return org_member.role in ALLOWED_ROLES


def is_team_linked_to_channel(organization: Organization, slack_request: SlackRequest) -> bool:
    """Check if a Slack channel already has a team linked to it"""
    return ExternalActor.objects.filter(
        organization=organization,
        integration=slack_request.integration,
        provider=ExternalProviders.SLACK.value,
        external_name=slack_request.channel_name,
        external_id=slack_request.channel_id,
    ).exists()


def get_identity(slack_request: SlackRequest) -> Optional[Identity]:
    try:
        identity = slack_request.get_identity()
    except IdentityProvider.DoesNotExist:
        identity = None
    return identity


class SlackCommandsEndpoint(SlackDMEndpoint):  # type: ignore
    authentication_classes = ()
    permission_classes = ()

    def get_command_and_args(self, payload: SlackRequest) -> Tuple[str, Sequence[str]]:
        payload = payload.data
        text = payload.get("text", "").lower().split()
        if not text:
            return "", []

        return text[0], text[1:]

    def reply(self, slack_request: SlackRequest, message: str) -> Response:
        return self.respond(
            {
                "response_type": "ephemeral",
                "replace_original": False,
                "text": message,
            }
        )

    def link_team(self, slack_request: SlackCommandRequest) -> Response:
        if slack_request.channel_name == DIRECT_MESSAGE_CHANNEL_NAME:
            return self.reply(slack_request, LINK_FROM_CHANNEL_MESSAGE)

        identity = get_identity(slack_request)
        if not identity:
            return self.reply(slack_request, LINK_USER_FIRST_MESSAGE)

        integration = slack_request.integration
        organization_memberships = OrganizationMember.objects.get_for_integration(
            integration, identity.user
        )
        if not organization_memberships:
            return self.reply(slack_request, INSUFFICIENT_ROLE_MESSAGE)

        organization = organization_memberships[0].organization
        if is_team_linked_to_channel(organization, slack_request):
            return self.reply(slack_request, CHANNEL_ALREADY_LINKED_MESSAGE)

        if not is_valid_role(organization_memberships[0]):
            return self.reply(slack_request, INSUFFICIENT_ROLE_MESSAGE)

        associate_url = build_team_linking_url(
            integration=integration,
            slack_id=slack_request.user_id,
            channel_id=slack_request.channel_id,
            channel_name=slack_request.channel_name,
            response_url=slack_request.response_url,
        )
        return self.reply(slack_request, LINK_TEAM_MESSAGE.format(associate_url=associate_url))

    def unlink_team(self, slack_request: SlackCommandRequest) -> Response:
        if slack_request.channel_name == DIRECT_MESSAGE_CHANNEL_NAME:
            return self.reply(slack_request, LINK_FROM_CHANNEL_MESSAGE)

        identity = get_identity(slack_request)
        if not identity:
            return self.reply(slack_request, LINK_USER_FIRST_MESSAGE)

        integration = slack_request.integration
        organization_memberships = OrganizationMember.objects.get_for_integration(
            integration, identity.user
        )
        if not organization_memberships:
            return self.reply(slack_request, INSUFFICIENT_ROLE_MESSAGE)

        organization = organization_memberships[0].organization
        if not is_team_linked_to_channel(organization, slack_request):
            return self.reply(slack_request, TEAM_NOT_LINKED_MESSAGE)

        if not is_valid_role(organization_memberships[0]):
            return self.reply(slack_request, INSUFFICIENT_ROLE_MESSAGE)

        associate_url = build_team_unlinking_url(
            integration=integration,
            organization_id=organization.id,
            slack_id=slack_request.user_id,
            channel_id=slack_request.channel_id,
            channel_name=slack_request.channel_name,
            response_url=slack_request.response_url,
        )
        return self.reply(slack_request, UNLINK_TEAM_MESSAGE.format(associate_url=associate_url))

    def post(self, request: Request) -> HttpResponse:
        try:
            slack_request = SlackCommandRequest(request)
            slack_request.validate()
        except SlackRequestError as e:
            if e.status == status.HTTP_403_FORBIDDEN:
                return self.respond(SlackDisconnectedMessageBuilder().build())
            return self.respond(status=e.status)

        return super().post_dispatcher(slack_request)
