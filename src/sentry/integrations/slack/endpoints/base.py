import abc
from typing import Any, Sequence, Tuple

from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.integrations.slack.message_builder.help import SlackHelpMessageBuilder
from sentry.integrations.slack.requests.base import SlackRequest
from sentry.integrations.slack.views.link_identity import build_linking_url
from sentry.integrations.slack.views.unlink_identity import build_unlinking_url

LINK_USER_MESSAGE = (
    "<{associate_url}|Link your Slack identity> to your Sentry account to receive notifications. "
    "You'll also be able to perform actions in Sentry through Slack. "
)
UNLINK_USER_MESSAGE = "<{associate_url}|Click here to unlink your identity.>"
NOT_LINKED_MESSAGE = "You do not have a linked identity to unlink."
ALREADY_LINKED_MESSAGE = "You are already linked as `{username}`."


class SlackDMEndpoint(Endpoint, abc.ABC):  # type: ignore
    def post_dispatcher(self, request: SlackRequest) -> Any:
        """
        All Slack commands are handled by this endpoint. This block just
        validates the request and dispatches it to the right handler.
        """
        command, args = self.get_command_and_args(request)

        if command in ["help", ""]:
            return self.respond(SlackHelpMessageBuilder().build())

        if command == "link":
            if not args:
                return self.link_user(request)

            if args[0] == "team":
                return self.link_team(request)

        if command == "unlink":
            if not args:
                return self.unlink_user(request)

            if args[0] == "team":
                return self.unlink_team(request)

        # If we cannot interpret the command, print help text.
        request_data = request.data
        unknown_command = request_data.get("text", "").lower()
        return self.respond(SlackHelpMessageBuilder(unknown_command).build())

    def get_command_and_args(self, request: SlackRequest) -> Tuple[str, Sequence[str]]:
        raise NotImplementedError

    def reply(self, slack_request: SlackRequest, message: str) -> Response:
        raise NotImplementedError

    def link_user(self, slack_request: SlackRequest) -> Any:
        if slack_request.has_identity:
            return self.reply(
                slack_request, ALREADY_LINKED_MESSAGE.format(username=slack_request.identity_str)
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
        return self.reply(slack_request, LINK_USER_MESSAGE.format(associate_url=associate_url))

    def unlink_user(self, slack_request: SlackRequest) -> Any:
        if not slack_request.has_identity:
            return self.reply(slack_request, NOT_LINKED_MESSAGE)

        integration = slack_request.integration
        associate_url = build_unlinking_url(
            integration_id=integration.id,
            slack_id=slack_request.user_id,
            channel_id=slack_request.channel_id,
            response_url=slack_request.response_url,
        )
        return self.reply(slack_request, UNLINK_USER_MESSAGE.format(associate_url=associate_url))

    def link_team(self, slack_request: SlackRequest) -> Any:
        raise NotImplementedError

    def unlink_team(self, slack_request: SlackRequest) -> Any:
        raise NotImplementedError
