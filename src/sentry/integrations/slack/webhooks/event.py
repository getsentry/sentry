from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Mapping, MutableMapping
from typing import Any

import orjson
from rest_framework.request import Request
from rest_framework.response import Response
from slack_sdk.errors import SlackApiError

from sentry import analytics, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import all_silo_endpoint
from sentry.integrations.services.integration import integration_service
from sentry.integrations.slack.message_builder.help import SlackHelpMessageBuilder
from sentry.integrations.slack.message_builder.prompt import SlackPromptLinkMessageBuilder
from sentry.integrations.slack.metrics import (
    SLACK_WEBHOOK_EVENT_ENDPOINT_FAILURE_DATADOG_METRIC,
    SLACK_WEBHOOK_EVENT_ENDPOINT_SUCCESS_DATADOG_METRIC,
)
from sentry.integrations.slack.requests.base import SlackDMRequest, SlackRequestError
from sentry.integrations.slack.requests.event import COMMANDS, SlackEventRequest
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.slack.unfurl.handlers import link_handlers, match_link
from sentry.integrations.slack.unfurl.types import LinkType, UnfurlableUrl
from sentry.integrations.slack.views.link_identity import build_linking_url
from sentry.organizations.services.organization import organization_service
from sentry.utils import metrics

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

    _METRIC_FAILURE_KEY = SLACK_WEBHOOK_EVENT_ENDPOINT_FAILURE_DATADOG_METRIC
    _METRICS_SUCCESS_KEY = SLACK_WEBHOOK_EVENT_ENDPOINT_SUCCESS_DATADOG_METRIC

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

        client = SlackSdkClient(integration_id=slack_request.integration.id)
        try:
            client.chat_postMessage(channel=slack_request.channel_id, text=message)
        except SlackApiError:
            _logger.exception("reply.post-message-error", extra=logger_params)
            metrics.incr(self._METRIC_FAILURE_KEY + ".reply.post_message", sample_rate=1.0)

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
            metrics.incr(self._METRIC_FAILURE_KEY + ".prompt_link.no_channel_id", sample_rate=1.0)
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
        try:
            client.chat_postEphemeral(
                channel=slack_request.channel_id,
                user=slack_request.user_id,
                text=payload["text"],
                **SlackPromptLinkMessageBuilder(associate_url).as_payload(),
            )
        except SlackApiError:
            _logger.exception("prompt_link.post-ephemeral-error", extra=logger_params)
            metrics.incr(self._METRIC_FAILURE_KEY + ".prompt_link.post_ephemeral", sample_rate=1.0)

    def on_message(self, request: Request, slack_request: SlackDMRequest) -> Response:
        command = request.data.get("event", {}).get("text", "").lower()
        if slack_request.is_bot() or not command:
            return self.respond()

        payload = {
            "channel": slack_request.channel_id,
            **SlackHelpMessageBuilder(command).as_payload(),
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
        try:
            client.chat_postMessage(
                channel=slack_request.channel_id,
                **SlackHelpMessageBuilder(command).as_payload(),
            )
        except SlackApiError:
            _logger.exception("on_message.post-message-error", extra=logger_params)
            metrics.incr(self._METRIC_FAILURE_KEY + ".on_message.post_message", sample_rate=1.0)

        return self.respond()

    def on_link_shared(self, request: Request, slack_request: SlackDMRequest) -> bool:
        """Returns true on success"""
        matches: MutableMapping[LinkType, list[UnfurlableUrl]] = defaultdict(list)
        links_seen = set()

        data = slack_request.data.get("event", {})

        logger_params = {
            "integration_id": slack_request.integration.id,
            "team_id": slack_request.team_id,
            "channel_id": slack_request.channel_id,
            "user_id": slack_request.user_id,
            "channel": slack_request.channel_id,
            **data,
        }

        # An unfurl may have multiple links to unfurl
        for item in data.get("links", []):
            try:
                url = item["url"]
            except Exception:
                _logger.exception("parse-link-error", extra={**logger_params, "url": url})
                continue

            link_type, args = match_link(url)

            # Link can't be unfurled
            if link_type is None or args is None:
                continue

            ois = integration_service.get_organization_integrations(
                integration_id=slack_request.integration.id, limit=1
            )
            organization_id = ois[0].organization_id if len(ois) > 0 else None
            organization_context = (
                organization_service.get_organization_by_id(
                    id=organization_id, user_id=None, include_projects=False, include_teams=False
                )
                if organization_id
                else None
            )
            organization = organization_context.organization if organization_context else None
            logger_params["organization_id"] = organization_id

            if (
                organization
                and link_type == LinkType.DISCOVER
                and not slack_request.has_identity
                and features.has("organizations:discover-basic", organization, actor=request.user)
            ):
                analytics.record(
                    "integrations.slack.chart_unfurl",
                    organization_id=organization.id,
                    unfurls_count=0,
                )
                self.prompt_link(slack_request)
                return True

            # Don't unfurl the same thing multiple times
            seen_marker = hash(orjson.dumps((link_type, list(args))).decode())
            if seen_marker in links_seen:
                continue

            links_seen.add(seen_marker)
            matches[link_type].append(UnfurlableUrl(url=url, args=args))

        if not matches:
            return False

        # Unfurl each link type
        results: MutableMapping[str, Any] = {}
        for link_type, unfurl_data in matches.items():
            results.update(
                link_handlers[link_type].fn(
                    request,
                    slack_request.integration,
                    unfurl_data,
                    slack_request.user,
                )
            )

        if not results:
            return False

        # XXX(isabella): we use our message builders to create the blocks for each link to be
        # unfurled, so the original result will include the fallback text string, however, the
        # unfurl endpoint does not accept fallback text.
        for link_info in results.values():
            if "text" in link_info:
                del link_info["text"]

        payload = {
            "channel": data["channel"],
            "ts": data["message_ts"],
            "unfurls": orjson.dumps(results).decode(),
        }

        client = SlackSdkClient(integration_id=slack_request.integration.id)
        try:
            client.chat_unfurl(
                channel=data["channel"],
                ts=data["message_ts"],
                unfurls=payload["unfurls"],
            )
        except SlackApiError:
            _logger.exception("on_link_shared.unfurl-error", extra=logger_params)
            metrics.incr(self._METRIC_FAILURE_KEY + ".unfurl", sample_rate=1.0)

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
