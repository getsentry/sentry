from __future__ import annotations

import abc

from rest_framework import status
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.integrations.slack.message_builder.help import SlackHelpMessageBuilder
from sentry.integrations.slack.metrics import (
    SLACK_WEBHOOK_DM_ENDPOINT_FAILURE_DATADOG_METRIC,
    SLACK_WEBHOOK_DM_ENDPOINT_SUCCESS_DATADOG_METRIC,
)
from sentry.integrations.slack.requests.base import SlackDMRequest, SlackRequestError

LINK_USER_MESSAGE = (
    "<{associate_url}|Link your Slack identity> to your Sentry account to receive notifications. "
    "You'll also be able to perform actions in Sentry through Slack. "
)
UNLINK_USER_MESSAGE = (
    "<{associate_url}|Click here to unlink your identity.>"
    "Once you do this, the Slack Integration will not be able to identify you. If you need to link your identity again, please use the /sentry link command"
)
NOT_LINKED_MESSAGE = "You do not have a linked identity to unlink."
ALREADY_LINKED_MESSAGE = "You are already linked as `{username}`."

import logging

from sentry.utils import metrics

logger = logging.getLogger(__name__)


class SlackDMEndpoint(Endpoint, abc.ABC):
    slack_request_class = SlackDMRequest

    _METRICS_SUCCESS_KEY = SLACK_WEBHOOK_DM_ENDPOINT_SUCCESS_DATADOG_METRIC
    _METRIC_FAILURE_KEY = SLACK_WEBHOOK_DM_ENDPOINT_FAILURE_DATADOG_METRIC

    def post_dispatcher(self, request: SlackDMRequest) -> Response:
        """
        All Slack commands are handled by this endpoint. This block just
        validates the request and dispatches it to the right handler.
        """
        command, args = request.get_command_and_args()

        if command in ["help", "", "support", "docs"]:
            return self.respond(SlackHelpMessageBuilder(command=command).build())

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

    def reply(self, slack_request: SlackDMRequest, message: str) -> Response:
        raise NotImplementedError

    def link_user(self, slack_request: SlackDMRequest) -> Response:
        from sentry.integrations.slack.views.link_identity import build_linking_url

        if slack_request.has_identity:
            return self.reply(
                slack_request, ALREADY_LINKED_MESSAGE.format(username=slack_request.identity_str)
            )

        if not (slack_request.integration and slack_request.user_id and slack_request.channel_id):
            logger.error(".link-user.bad_request.error", extra={"slack_request": slack_request})
            metrics.incr(self._METRIC_FAILURE_KEY + "link_user.bad_request", sample_rate=1.0)
            raise SlackRequestError(status=status.HTTP_400_BAD_REQUEST)

        associate_url = build_linking_url(
            integration=slack_request.integration,
            slack_id=slack_request.user_id,
            channel_id=slack_request.channel_id,
            response_url=slack_request.response_url,
        )

        metrics.incr(self._METRICS_SUCCESS_KEY + ".link_user", sample_rate=1.0)

        return self.reply(slack_request, LINK_USER_MESSAGE.format(associate_url=associate_url))

    def unlink_user(self, slack_request: SlackDMRequest) -> Response:
        from sentry.integrations.slack.views.unlink_identity import build_unlinking_url

        if not slack_request.has_identity:
            logger.error(".unlink-user.no-identity.error", extra={"slack_request": slack_request})
            metrics.incr(self._METRIC_FAILURE_KEY + "unlink_user.no_identity", sample_rate=1.0)

            return self.reply(slack_request, NOT_LINKED_MESSAGE)

        if not (slack_request.integration and slack_request.user_id and slack_request.channel_id):
            logger.error(".unlink-user.bad_request.error", extra={"slack_request": slack_request})
            metrics.incr(self._METRIC_FAILURE_KEY + "unlink_user.bad_request", sample_rate=1.0)

            raise SlackRequestError(status=status.HTTP_400_BAD_REQUEST)

        associate_url = build_unlinking_url(
            integration_id=slack_request.integration.id,
            slack_id=slack_request.user_id,
            channel_id=slack_request.channel_id,
            response_url=slack_request.response_url,
        )

        metrics.incr(self._METRICS_SUCCESS_KEY + ".unlink_user", sample_rate=1.0)

        return self.reply(slack_request, UNLINK_USER_MESSAGE.format(associate_url=associate_url))

    def link_team(self, slack_request: SlackDMRequest) -> Response:
        raise NotImplementedError

    def unlink_team(self, slack_request: SlackDMRequest) -> Response:
        raise NotImplementedError
