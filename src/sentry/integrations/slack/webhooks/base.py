from __future__ import annotations

import abc
import logging
from collections.abc import Iterable
from dataclasses import dataclass

from rest_framework import status
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.integrations.messaging import commands
from sentry.integrations.messaging.commands import (
    CommandHandler,
    CommandInput,
    CommandNotMatchedError,
    MessagingIntegrationCommand,
    MessagingIntegrationCommandDispatcher,
)
from sentry.integrations.messaging.metrics import MessageCommandHaltReason
from sentry.integrations.messaging.spec import MessagingIntegrationSpec
from sentry.integrations.slack.message_builder.help import SlackHelpMessageBuilder
from sentry.integrations.slack.metrics import (
    SLACK_WEBHOOK_DM_ENDPOINT_FAILURE_DATADOG_METRIC,
    SLACK_WEBHOOK_DM_ENDPOINT_SUCCESS_DATADOG_METRIC,
)
from sentry.integrations.slack.requests.base import SlackDMRequest, SlackRequestError
from sentry.integrations.slack.spec import SlackMessagingSpec
from sentry.integrations.types import EventLifecycleOutcome, IntegrationResponse
from sentry.utils import metrics

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
        cmd_input = request.get_command_input()
        try:
            return SlackCommandDispatcher(self, request).dispatch(cmd_input)
        except CommandNotMatchedError:
            # If we cannot interpret the command, print help text.
            request_data = request.data
            unknown_command = request_data.get("text", "").lower()
            return self.help(unknown_command)

    def reply(self, slack_request: SlackDMRequest, message: str) -> Response:
        raise NotImplementedError

    def help(self, command: str) -> Response:
        return self.respond(SlackHelpMessageBuilder(command).build())

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


@dataclass(frozen=True)
class SlackCommandDispatcher(MessagingIntegrationCommandDispatcher[Response]):
    endpoint: SlackDMEndpoint
    request: SlackDMRequest

    # Define mapping of messages to halt reasons
    @property
    def TEAM_HALT_MAPPINGS(self) -> dict[str, MessageCommandHaltReason]:
        from sentry.integrations.slack.webhooks.command import (
            CHANNEL_ALREADY_LINKED_MESSAGE,
            INSUFFICIENT_ROLE_MESSAGE,
            LINK_FROM_CHANNEL_MESSAGE,
            LINK_USER_FIRST_MESSAGE,
            TEAM_NOT_LINKED_MESSAGE,
        )

        return {
            LINK_FROM_CHANNEL_MESSAGE: MessageCommandHaltReason.LINK_FROM_CHANNEL,
            LINK_USER_FIRST_MESSAGE: MessageCommandHaltReason.LINK_USER_FIRST,
            INSUFFICIENT_ROLE_MESSAGE: MessageCommandHaltReason.INSUFFICIENT_ROLE,
            CHANNEL_ALREADY_LINKED_MESSAGE: MessageCommandHaltReason.CHANNEL_ALREADY_LINKED,
            TEAM_NOT_LINKED_MESSAGE: MessageCommandHaltReason.TEAM_NOT_LINKED,
        }

    @property
    def integration_spec(self) -> MessagingIntegrationSpec:
        return SlackMessagingSpec()

    def help_handler(self, input: CommandInput) -> IntegrationResponse[Response]:
        response = self.endpoint.help(input.cmd_value)
        return IntegrationResponse(
            interaction_result=EventLifecycleOutcome.SUCCESS,
            response=response,
        )

    def link_user_handler(self, input: CommandInput) -> IntegrationResponse[Response]:
        response = self.endpoint.link_user(self.request)
        if ALREADY_LINKED_MESSAGE.format(username=self.request.identity_str) in str(response.data):
            return IntegrationResponse(
                interaction_result=EventLifecycleOutcome.SUCCESS,
                response=response,
                outcome_reason=str(MessageCommandHaltReason.ALREADY_LINKED),
                context_data={
                    "email": self.request.identity_str,
                },
            )
        return IntegrationResponse(
            interaction_result=EventLifecycleOutcome.SUCCESS,
            response=response,
        )

    def unlink_user_handler(self, input: CommandInput) -> IntegrationResponse[Response]:
        response = self.endpoint.unlink_user(self.request)
        if NOT_LINKED_MESSAGE in str(response.data):
            return IntegrationResponse(
                interaction_result=EventLifecycleOutcome.SUCCESS,
                response=response,
                outcome_reason=str(MessageCommandHaltReason.NOT_LINKED),
                context_data={
                    "email": self.request.identity_str,
                },
            )
        return IntegrationResponse(
            interaction_result=EventLifecycleOutcome.SUCCESS,
            response=response,
        )

    def link_team_handler(self, input: CommandInput) -> IntegrationResponse[Response]:
        response = self.endpoint.link_team(self.request)

        for message, reason in self.TEAM_HALT_MAPPINGS.items():
            if message in str(response.data):
                return IntegrationResponse(
                    interaction_result=EventLifecycleOutcome.SUCCESS,
                    response=response,
                    outcome_reason=str(reason),
                )

        return IntegrationResponse(
            interaction_result=EventLifecycleOutcome.SUCCESS,
            response=response,
        )

    def unlink_team_handler(self, input: CommandInput) -> IntegrationResponse[Response]:
        response = self.endpoint.unlink_team(self.request)
        for message, reason in self.TEAM_HALT_MAPPINGS.items():
            if message in str(response.data):
                return IntegrationResponse(
                    interaction_result=EventLifecycleOutcome.HALTED,
                    response=response,
                    outcome_reason=str(reason),
                )

        return IntegrationResponse(
            interaction_result=EventLifecycleOutcome.SUCCESS,
            response=response,
        )

    @property
    def command_handlers(
        self,
    ) -> Iterable[tuple[MessagingIntegrationCommand, CommandHandler[Response]]]:

        yield commands.HELP, self.help_handler
        yield commands.LINK_IDENTITY, self.link_user_handler
        yield commands.UNLINK_IDENTITY, self.unlink_user_handler
        yield commands.LINK_TEAM, self.link_team_handler
        yield commands.UNLINK_TEAM, self.unlink_team_handler
