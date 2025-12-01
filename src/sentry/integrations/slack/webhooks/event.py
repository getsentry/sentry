from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Mapping
from typing import Any

import orjson
import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response
from slack_sdk.errors import SlackApiError

from sentry import analytics, features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import all_silo_endpoint
from sentry.integrations.messaging.metrics import (
    MessagingInteractionEvent,
    MessagingInteractionType,
)
from sentry.integrations.services.integration import integration_service
from sentry.integrations.slack.analytics import SlackIntegrationChartUnfurl
from sentry.integrations.slack.message_builder.help import SlackHelpMessageBuilder
from sentry.integrations.slack.message_builder.prompt import SlackPromptLinkMessageBuilder
from sentry.integrations.slack.requests.base import SlackDMRequest, SlackRequestError
from sentry.integrations.slack.requests.event import COMMANDS, SlackEventRequest
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.slack.spec import SlackMessagingSpec
from sentry.integrations.slack.unfurl.handlers import link_handlers, match_link
from sentry.integrations.slack.unfurl.types import LinkType, UnfurlableUrl
from sentry.integrations.slack.views.link_identity import build_linking_url
from sentry.organizations.services.organization import organization_service
from sentry.organizations.services.organization.model import RpcOrganization

from .base import SlackDMEndpoint
from .command import LINK_FROM_CHANNEL_MESSAGE

_logger = logging.getLogger(__name__)


@all_silo_endpoint  # Only challenge verification is handled at control
class SlackEventEndpoint(SlackDMEndpoint):
    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    """
    XXX(dcramer): a lot of this is copied from sentry-plugins right now, and will need refactoring
    """

    authentication_classes = ()
    permission_classes = ()
    slack_request_class = SlackEventRequest

    def reply(self, slack_request: SlackDMRequest, message: str) -> Response:
        logger_params = {
            "integration_id": slack_request.integration.id,
            "team_id": slack_request.team_id,
            "channel_id": slack_request.channel_id,
            "user_id": slack_request.user_id,
            "channel": slack_request.channel_id,
            "message": message,
        }
        if slack_request.channel_id is None:
            _logger.info("reply.post-message-error", extra=logger_params)
        else:
            client = SlackSdkClient(integration_id=slack_request.integration.id)
            try:
                client.chat_postMessage(channel=slack_request.channel_id, text=message)
            except SlackApiError:
                _logger.info("reply.post-message-error", extra=logger_params)

        return self.respond()

    def link_team(self, slack_request: SlackDMRequest) -> Response:
        return self.reply(slack_request, LINK_FROM_CHANNEL_MESSAGE)

    def unlink_team(self, slack_request: SlackDMRequest) -> Response:
        return self.reply(slack_request, LINK_FROM_CHANNEL_MESSAGE)

    def on_url_verification(self, request: Request, data: Mapping[str, str]) -> Response:
        return self.respond({"challenge": data["challenge"]})

    def prompt_link(self, slack_request: SlackDMRequest) -> None:
        associate_url = build_linking_url(
            integration=slack_request.integration,
            slack_id=slack_request.user_id,
            channel_id=slack_request.channel_id,
            response_url=slack_request.response_url,
        )
        if not slack_request.channel_id:
            return

        payload = {
            "channel": slack_request.channel_id,
            "user": slack_request.user_id,
            "text": "Link your Slack identity to Sentry to unfurl Discover charts.",
            **SlackPromptLinkMessageBuilder(associate_url).as_payload(),
        }

        logger_params = {
            "integration_id": slack_request.integration.id,
            "team_id": slack_request.team_id,
            "channel_id": slack_request.channel_id,
            "user_id": slack_request.user_id,
            "channel": slack_request.channel_id,
            **payload,
        }

        client = SlackSdkClient(integration_id=slack_request.integration.id)
        if slack_request.user_id is None:
            _logger.error("prompt_link.post-ephemeral-error", extra=logger_params)
        else:
            try:
                client.chat_postEphemeral(
                    channel=slack_request.channel_id,
                    user=slack_request.user_id,
                    text=payload["text"],
                    **SlackPromptLinkMessageBuilder(associate_url).as_payload(),
                )
            except SlackApiError:
                _logger.exception("prompt_link.post-ephemeral-error", extra=logger_params)

    def on_message(self, request: Request, slack_request: SlackDMRequest) -> Response:
        command = request.data.get("event", {}).get("text", "").lower()
        if slack_request.is_bot() or not command:
            return self.respond()

        payload = {
            "channel": slack_request.channel_id,
            **SlackHelpMessageBuilder(
                command=command,
                integration_id=slack_request.integration.id,
            ).as_payload(),
        }
        logger_params = {
            "integration_id": slack_request.integration.id,
            "team_id": slack_request.team_id,
            "channel_id": slack_request.channel_id,
            "user_id": slack_request.user_id,
            "channel": slack_request.channel_id,
            **payload,
        }

        client = SlackSdkClient(integration_id=slack_request.integration.id)
        if slack_request.channel_id is None:
            _logger.error("on_message.post-message-error", extra=logger_params)
        else:
            try:
                client.chat_postMessage(
                    channel=slack_request.channel_id,
                    **SlackHelpMessageBuilder(
                        command=command,
                        integration_id=slack_request.integration.id,
                    ).as_payload(),
                )
            except SlackApiError:
                _logger.exception("on_message.post-message-error", extra=logger_params)

        return self.respond()

    def _get_unfurlable_links(
        self,
        request: Request,
        slack_request: SlackDMRequest,
        data: dict[str, Any],
        organization: RpcOrganization | None,
        logger_params: dict[str, Any],
    ) -> dict[LinkType, list[UnfurlableUrl]]:
        matches: dict[LinkType, list[UnfurlableUrl]] = defaultdict(list)
        links_seen = set()

        for item in data.get("links", []):
            with MessagingInteractionEvent(
                interaction_type=MessagingInteractionType.PROCESS_SHARED_LINK,
                spec=SlackMessagingSpec(),
            ).capture() as lifecycle:
                try:
                    url = item["url"]
                except Exception:
                    lifecycle.record_failure("Failed to parse link", extra={**logger_params})
                    continue

                link_type, args = match_link(url)

                # Link can't be unfurled
                if link_type is None or args is None:
                    continue

                if (
                    organization
                    and link_type == LinkType.DISCOVER
                    and not slack_request.has_identity
                    and features.has(
                        "organizations:discover-basic", organization, actor=request.user
                    )
                ):
                    try:
                        analytics.record(
                            SlackIntegrationChartUnfurl(
                                organization_id=organization.id,
                                unfurls_count=0,
                            )
                        )
                    except Exception as e:
                        sentry_sdk.capture_exception(e)

                    self.prompt_link(slack_request)
                    lifecycle.record_halt("Discover link requires identity", extra={"url": url})
                    return {}

                # Don't unfurl the same thing multiple times
                seen_marker = hash(orjson.dumps((link_type, list(args))).decode())
                if seen_marker in links_seen:
                    continue

                links_seen.add(seen_marker)
                matches[link_type].append(UnfurlableUrl(url=url, args=args))

        return matches

    def _unfurl_links(
        self, slack_request: SlackDMRequest, matches: dict[LinkType, list[UnfurlableUrl]]
    ) -> dict[str, Any]:
        results: dict[str, Any] = {}
        for link_type, unfurl_data in matches.items():
            results.update(
                link_handlers[link_type].fn(
                    slack_request.integration, unfurl_data, slack_request.user
                )
            )

        # XXX(isabella): we use our message builders to create the blocks for each link to be
        # unfurled, so the original result will include the fallback text string, however, the
        # unfurl endpoint does not accept fallback text.
        for link_info in results.values():
            if "text" in link_info:
                del link_info["text"]

        return results

    def on_link_shared(self, request: Request, slack_request: SlackDMRequest) -> bool:
        """Returns true on success"""

        data = slack_request.data.get("event", {})

        ois = integration_service.get_organization_integrations(
            integration_id=slack_request.integration.id, limit=1
        )
        organization_id = ois[0].organization_id if len(ois) > 0 else None
        organization_context = (
            organization_service.get_organization_by_id(
                id=organization_id,
                user_id=None,
                include_projects=False,
                include_teams=False,
            )
            if organization_id
            else None
        )
        organization = organization_context.organization if organization_context else None

        logger_params = {
            "integration_id": slack_request.integration.id,
            "team_id": slack_request.team_id,
            "channel_id": slack_request.channel_id,
            "user_id": slack_request.user_id,
            "channel": slack_request.channel_id,
            "organization_id": organization_id,
            **data,
        }

        # An unfurl may have multiple links to unfurl
        matches = self._get_unfurlable_links(
            request, slack_request, data, organization, logger_params
        )
        if not matches:
            return False

        # Unfurl each link type
        results = self._unfurl_links(slack_request, matches)
        if not results:
            return False

        with MessagingInteractionEvent(
            interaction_type=MessagingInteractionType.UNFURL_LINK,
            spec=SlackMessagingSpec(),
        ).capture() as lifecycle:
            payload = {"channel": data["channel"], "ts": data["message_ts"], "unfurls": results}
            client = SlackSdkClient(integration_id=slack_request.integration.id)
            try:
                client.chat_unfurl(
                    channel=data["channel"],
                    ts=data["message_ts"],
                    unfurls=payload["unfurls"],
                )
            except SlackApiError as e:
                lifecycle.add_extras(logger_params)
                if options.get("slack.log-unfurl-payload", False):
                    lifecycle.add_extra("unfurls", payload["unfurls"])
                lifecycle.record_failure(e)
                return False

        return True

    # TODO(dcramer): implement app_uninstalled and tokens_revoked
    def post(self, request: Request) -> Response:
        try:
            slack_request = self.slack_request_class(request)
            slack_request.validate()
        except SlackRequestError as e:
            return self.respond(status=e.status)

        if slack_request.is_challenge():
            return self.on_url_verification(request, slack_request.data)
        if slack_request.type == "link_shared":
            if self.on_link_shared(request, slack_request):
                return self.respond()

        if slack_request.type == "message":
            if slack_request.is_bot():
                return self.respond()

            command, _ = slack_request.get_command_and_args()

            if command in COMMANDS:
                resp = super().post_dispatcher(slack_request)

            else:
                resp = self.on_message(request, slack_request)

            if resp:
                return resp

        return self.respond()
