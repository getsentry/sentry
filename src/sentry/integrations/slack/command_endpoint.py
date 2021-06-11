import logging
from typing import List, Mapping

from django.http import HttpResponse
from rest_framework.request import Request

from sentry.api.base import Endpoint
from sentry.integrations.slack.message_builder.help import SlackHelpMessageBuilder
from sentry.integrations.slack.requests.base import SlackRequestError
from sentry.integrations.slack.requests.command import SlackCommandRequest

logger = logging.getLogger("sentry.integrations.slack")


def get_command(payload: Mapping[str, List[str]]) -> str:
    text = payload.get("text", [""])[0]
    return text.split(" ")[0].lower()


class SlackCommandsEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    def post(self, request: Request) -> HttpResponse:
        """
        All Slack commands and handled by this endpoint. This block just
        validates the request and dispatches it to the right handler.
        """
        try:

            slack_request = SlackCommandRequest(request)
            slack_request.validate()
        except SlackRequestError as e:
            return self.respond(status=e.status)

        payload = slack_request.data
        command = get_command(payload)

        if command in ["help", ""]:
            return self.respond(SlackHelpMessageBuilder().build())

        # TODO(mgaeta): Add more commands.

        # If we cannot interpret the command, print help text.
        return self.respond(SlackHelpMessageBuilder(command).build())
