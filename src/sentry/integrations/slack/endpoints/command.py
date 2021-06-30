import logging
from typing import Mapping, Sequence, Tuple

from django.http import Http404, HttpResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.integrations.slack.message_builder.help import SlackHelpMessageBuilder
from sentry.integrations.slack.requests.base import SlackRequestError
from sentry.integrations.slack.requests.command import SlackCommandRequest
from sentry.integrations.slack.views.link_team import build_linking_url
from sentry.models import Identity, IdentityProvider

logger = logging.getLogger("sentry.integrations.slack")
LINK_TEAM_MESSAGE = "Link your Sentry team to this Slack channel! <{associate_url}|Link your team now> to receive notifications of issues in Sentry in Slack."
LINK_USER_MESSAGE = "You must first link your identity to Sentry by typing /sentry link. Be aware that you must be an admin or higher in your Sentry organization to link your team."
LINK_FROM_CHANNEL_MESSAGE = "You must type this command in a channel, not a DM."


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

    def post(self, request: Request) -> HttpResponse:
        """
        All Slack commands are handled by this endpoint. This block just
        validates the request and dispatches it to the right handler.
        """
        try:
            slack_request = SlackCommandRequest(request)
            slack_request.validate()
        except SlackRequestError as e:
            return self.respond(status=e.status)

        payload = slack_request.data
        command, args = get_command_and_args(payload)
        # TODO(mgaeta): Add more commands.
        if command in ["help", ""]:
            return self.respond(SlackHelpMessageBuilder().build())
        if command == "link":
            if args and args[0] == "team":
                channel_name = payload.get("channel_name", "")
                if channel_name == "directmessage":
                    return self.send_ephemeral_notification(LINK_FROM_CHANNEL_MESSAGE)
                integration = slack_request.integration
                user_id = payload.get("user_id")
                try:
                    idp = IdentityProvider.objects.get(
                        type="slack", external_id=slack_request.team_id
                    )
                except IdentityProvider.DoesNotExist:
                    logger.error(
                        "slack.action.invalid-team-id", extra={"slack_team": slack_request.team_id}
                    )
                    raise Http404

                if not Identity.objects.filter(idp=idp, external_id=user_id).exists():
                    return self.send_ephemeral_notification(LINK_USER_MESSAGE)
                channel_id = payload.get("channel_id", "")
                user_id = payload.get("user_id", "")
                response_url = payload.get("response_url")
                associate_url = build_linking_url(
                    integration, user_id, channel_id, channel_name, response_url
                )
                return self.send_ephemeral_notification(
                    LINK_TEAM_MESSAGE.format(associate_url=associate_url)
                )

        # If we cannot interpret the command, print help text.
        return self.respond(SlackHelpMessageBuilder(command).build())
