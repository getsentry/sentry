import logging
from typing import Mapping

from django.http import HttpResponse
from rest_framework.request import Request

from sentry.api.base import Endpoint
from sentry.integrations.slack.link_team import build_linking_url
from sentry.integrations.slack.message_builder.help import SlackHelpMessageBuilder
from sentry.integrations.slack.requests.base import SlackRequestError
from sentry.integrations.slack.requests.command import SlackCommandRequest
from sentry.models import Identity, IdentityProvider

logger = logging.getLogger("sentry.integrations.slack")
LINK_TEAM_MESSAGE = "Link your Sentry team to this Slack channel! <{associate_url}|Link your team now> to receive notifications of issues in Sentry in Slack."
LINK_USER_MESSAGE = "Who dis? Type `/sentry link` to tell me and btw you better be an admin or you're still not gonna be able to link your team."


def get_command(payload: Mapping[str, str]) -> str:
    return payload.get("text", "").lower()


class SlackCommandsEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    def send_ephemeral_notification(self, message):
        return self.respond(
            {
                "response_type": "ephemeral",
                "replace_original": False,
                "text": message,
            }
        )

    def get_identity(self, team_id, user_id):
        try:
            idp = IdentityProvider.objects.get(type="slack", external_id=team_id)
        except IdentityProvider.DoesNotExist:
            logger.error("slack.action.invalid-team-id", extra={"slack_team": team_id})
            return self.respond(status=403)

        try:
            identity = Identity.objects.select_related("user").get(idp=idp, external_id=user_id)
        except Identity.DoesNotExist:
            return self.send_ephemeral_notification(LINK_USER_MESSAGE)
        return identity

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
        command = get_command(payload)
        # TODO(mgaeta): Add more commands.
        if command in ["help", ""]:
            return self.respond(SlackHelpMessageBuilder().build())
        if command == "link team":
            integration = slack_request.integration
            user_id = payload.get("user_id")
            self.get_identity(slack_request.team_id, user_id)
            channel_id = payload.get("channel_id", "")
            channel_name = payload.get("channel_name", "")
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
