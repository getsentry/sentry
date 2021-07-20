import logging
from typing import Mapping, Sequence, Tuple

from django.http import HttpResponse
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import Endpoint
from sentry.integrations.slack.message_builder.disconnected import SlackDisconnectedMessageBuilder
from sentry.integrations.slack.message_builder.help import SlackHelpMessageBuilder
from sentry.integrations.slack.requests.base import SlackRequestError
from sentry.integrations.slack.requests.command import SlackCommandRequest
from sentry.integrations.slack.views.link_identity import build_linking_url
from sentry.integrations.slack.views.link_team import build_team_linking_url
from sentry.integrations.slack.views.unlink_identity import build_unlinking_url
from sentry.integrations.slack.views.unlink_team import build_team_unlinking_url
from sentry.models import ExternalActor
from sentry.types.integrations import ExternalProviders

logger = logging.getLogger("sentry.integrations.slack")

LINK_TEAM_MESSAGE = (
    "Link your Sentry team to this Slack channel! <{associate_url}|Link your team now> to receive "
    "notifications of issues in Sentry in Slack."
)
LINK_USER_MESSAGE = (
    "<{associate_url}|Link your Slack identity> to your Sentry account to receive notifications. "
    "You'll also be able to perform actions in Sentry through Slack. "
)
LINK_USER_FIRST_MESSAGE = (
    "You must first link your identity to Sentry by typing /sentry link. Be aware that you "
    "must be an admin or higher in your Sentry organization to link your team."
)
LINK_FROM_CHANNEL_MESSAGE = "You must type this command in a channel, not a DM."
UNLINK_USER_MESSAGE = "<{associate_url}|Click here to unlink your identity.>"
UNLINK_TEAM_MESSAGE = "<{associate_url}|Click here to unlink your team from this channel.>"
NOT_LINKED_MESSAGE = "You do not have a linked identity to unlink."
TEAM_NOT_LINKED_MESSAGE = "No team is linked to this channel."
ALREADY_LINKED_MESSAGE = "You are already linked as `{username}`."
DIRECT_MESSAGE_CHANNEL_NAME = "directmessage"
FEATURE_FLAG_MESSAGE = "This feature hasn't been released yet, hang tight."


def get_command_and_args(payload: Mapping[str, str]) -> Tuple[str, Sequence[str]]:
    text = payload.get("text", "").lower().split()
    if not text:
        return "", []

    return text[0], text[1:]


class SlackCommandsEndpoint(Endpoint):  # type: ignore
    authentication_classes = ()
    permission_classes = ()

    def send_ephemeral_notification(self, message: str) -> Response:
        return self.respond(
            {
                "response_type": "ephemeral",
                "replace_original": False,
                "text": message,
            }
        )

    def link_user(self, slack_request: SlackCommandRequest) -> Response:
        if slack_request.has_identity:
            return self.send_ephemeral_notification(
                ALREADY_LINKED_MESSAGE.format(username=slack_request.identity_str)
            )

        integration = slack_request.integration
        organization = integration.organizations.all()[0]
        associate_url = build_linking_url(
            integration=integration,
            organization=organization,
            slack_id=slack_request.user_id,
            channel_id=slack_request.channel_id,
            response_url=slack_request.response_url,
        )
        return self.send_ephemeral_notification(
            LINK_USER_MESSAGE.format(associate_url=associate_url)
        )

    def unlink_user(self, slack_request: SlackCommandRequest) -> Response:
        if not slack_request.has_identity:
            return self.send_ephemeral_notification(NOT_LINKED_MESSAGE)

        integration = slack_request.integration
        organization = integration.organizations.all()[0]
        associate_url = build_unlinking_url(
            integration_id=integration.id,
            organization_id=organization.id,
            slack_id=slack_request.user_id,
            channel_id=slack_request.channel_id,
            response_url=slack_request.response_url,
        )
        return self.send_ephemeral_notification(
            UNLINK_USER_MESSAGE.format(associate_url=associate_url)
        )

    def link_team(self, slack_request: SlackCommandRequest) -> Response:

        if slack_request.channel_name == DIRECT_MESSAGE_CHANNEL_NAME:
            return self.send_ephemeral_notification(LINK_FROM_CHANNEL_MESSAGE)

        if not slack_request.has_identity:
            return self.send_ephemeral_notification(LINK_USER_FIRST_MESSAGE)

        associate_url = build_team_linking_url(
            integration=slack_request.integration,
            slack_id=slack_request.user_id,
            channel_id=slack_request.channel_id,
            channel_name=slack_request.channel_name,
            response_url=slack_request.response_url,
        )
        return self.send_ephemeral_notification(
            LINK_TEAM_MESSAGE.format(associate_url=associate_url)
        )

    def unlink_team(self, slack_request: SlackCommandRequest) -> Response:

        if slack_request.channel_name == DIRECT_MESSAGE_CHANNEL_NAME:
            return self.send_ephemeral_notification(LINK_FROM_CHANNEL_MESSAGE)

        if not slack_request.has_identity:
            return self.send_ephemeral_notification(LINK_USER_FIRST_MESSAGE)

        integration = slack_request.integration
        organization = integration.organizations.all()[0]

        if not ExternalActor.objects.filter(
            organization=organization,
            integration=integration,
            provider=ExternalProviders.SLACK.value,
            external_name=slack_request.channel_name,
            external_id=slack_request.channel_id,
        ).exists():
            return self.send_ephemeral_notification(TEAM_NOT_LINKED_MESSAGE)

        associate_url = build_team_unlinking_url(
            integration=integration,
            organization_id=organization.id,
            slack_id=slack_request.user_id,
            channel_id=slack_request.channel_id,
            channel_name=slack_request.channel_name,
            response_url=slack_request.response_url,
        )
        return self.send_ephemeral_notification(
            UNLINK_TEAM_MESSAGE.format(associate_url=associate_url)
        )

    def post(self, request: Request) -> HttpResponse:
        """
        All Slack commands are handled by this endpoint. This block just
        validates the request and dispatches it to the right handler.
        """
        try:
            slack_request = SlackCommandRequest(request)
            slack_request.validate()
        except SlackRequestError as e:
            if e.status == status.HTTP_403_FORBIDDEN:
                return self.respond(SlackDisconnectedMessageBuilder().build())
            return self.respond(status=e.status)

        command, args = get_command_and_args(slack_request.data)
        if command in ["help", ""]:
            return self.respond(SlackHelpMessageBuilder().build())

        integration = slack_request.integration
        organization = integration.organizations.all()[0]
        if command in ["link", "unlink"] and not features.has(
            "organizations:notification-platform", organization
        ):
            return self.send_ephemeral_notification(FEATURE_FLAG_MESSAGE)

        if command == "link":
            if not args:
                return self.link_user(slack_request)

            if args[0] == "team":
                return self.link_team(slack_request)

        if command == "unlink":
            if not args:
                return self.unlink_user(slack_request)

            if args[0] == "team":
                return self.unlink_team(slack_request)

        # If we cannot interpret the command, print help text.
        return self.respond(SlackHelpMessageBuilder(command).build())
