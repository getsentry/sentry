import logging
from typing import Sequence, Tuple

from django.http import HttpResponse
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.integrations.slack.message_builder.disconnected import SlackDisconnectedMessageBuilder
from sentry.integrations.slack.requests.base import SlackRequest, SlackRequestError
from sentry.integrations.slack.requests.command import SlackCommandRequest
from sentry.integrations.slack.views.link_team import build_team_linking_url
from sentry.integrations.slack.views.unlink_team import build_team_unlinking_url
from sentry.models import ExternalActor
from sentry.types.integrations import ExternalProviders

from .base import SlackDMEndpoint

logger = logging.getLogger("sentry.integrations.slack")

LINK_TEAM_MESSAGE = (
    "Link your Sentry team to this Slack channel! <{associate_url}|Link your team now> to receive "
    "notifications of issues in Sentry in Slack."
)
LINK_USER_FIRST_MESSAGE = (
    "You must first link your identity to Sentry by typing /sentry link. Be aware that you "
    "must be an admin or higher in your Sentry organization to link your team."
)
LINK_FROM_CHANNEL_MESSAGE = "You must type this command in a channel, not a DM."
UNLINK_TEAM_MESSAGE = "<{associate_url}|Click here to unlink your team from this channel.>"
TEAM_NOT_LINKED_MESSAGE = "No team is linked to this channel."
DIRECT_MESSAGE_CHANNEL_NAME = "directmessage"


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

        if not slack_request.has_identity:
            return self.reply(slack_request, LINK_USER_FIRST_MESSAGE)

        associate_url = build_team_linking_url(
            integration=slack_request.integration,
            slack_id=slack_request.user_id,
            channel_id=slack_request.channel_id,
            channel_name=slack_request.channel_name,
            response_url=slack_request.response_url,
        )
        return self.reply(slack_request, LINK_TEAM_MESSAGE.format(associate_url=associate_url))

    def unlink_team(self, slack_request: SlackCommandRequest) -> Response:

        if slack_request.channel_name == DIRECT_MESSAGE_CHANNEL_NAME:
            return self.reply(slack_request, LINK_FROM_CHANNEL_MESSAGE)

        if not slack_request.has_identity:
            return self.reply(slack_request, LINK_USER_FIRST_MESSAGE)

        integration = slack_request.integration
        organization = integration.organizations.all()[0]

        if not ExternalActor.objects.filter(
            organization=organization,
            integration=integration,
            provider=ExternalProviders.SLACK.value,
            external_name=slack_request.channel_name,
            external_id=slack_request.channel_id,
        ).exists():
            return self.reply(slack_request, TEAM_NOT_LINKED_MESSAGE)

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
