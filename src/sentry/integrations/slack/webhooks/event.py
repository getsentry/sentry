from __future__ import annotations

from collections import defaultdict
from typing import Any, Mapping, MutableMapping

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.integrations.slack.client import SlackClient
from sentry.integrations.slack.message_builder.help import SlackHelpMessageBuilder
from sentry.integrations.slack.message_builder.prompt import SlackPromptLinkMessageBuilder
from sentry.integrations.slack.requests.base import SlackDMRequest, SlackRequestError
from sentry.integrations.slack.requests.event import COMMANDS, SlackEventRequest
from sentry.integrations.slack.unfurl import LinkType, UnfurlableUrl, link_handlers, match_link
from sentry.integrations.slack.views.link_identity import build_linking_url
from sentry.models import Integration
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import json
from sentry.utils.urls import parse_link
from sentry.web.decorators import transaction_start

from ..utils import logger
from .base import SlackDMEndpoint
from .command import LINK_FROM_CHANNEL_MESSAGE


class SlackEventEndpoint(SlackDMEndpoint):
    """
    XXX(dcramer): a lot of this is copied from sentry-plugins right now, and will need refactoring
    """

    authentication_classes = ()
    permission_classes = ()

    def reply(self, slack_request: SlackDMRequest, message: str) -> Response:
        headers = {"Authorization": f"Bearer {self._get_access_token(slack_request.integration)}"}
        payload = {"channel": slack_request.channel_name, "text": message}
        client = SlackClient()
        try:
            client.post("/chat.postMessage", headers=headers, data=payload, json=True)
        except ApiError as e:
            logger.error("slack.event.on-message-error", extra={"error": str(e)})

        return self.respond()

    def link_team(self, slack_request: SlackDMRequest) -> Response:
        return self.reply(slack_request, LINK_FROM_CHANNEL_MESSAGE)

    def unlink_team(self, slack_request: SlackDMRequest) -> Response:
        return self.reply(slack_request, LINK_FROM_CHANNEL_MESSAGE)

    def _get_access_token(self, integration: Integration) -> str:
        """
        The classic bot tokens must use the user auth token for URL unfurling we
        stored the user_access_token there but for workspace apps and new Slack
        bot tokens, we can just use access_token.
        """
        access_token: str = (
            integration.metadata.get("user_access_token") or integration.metadata["access_token"]
        )
        return access_token

    def on_url_verification(self, request: Request, data: Mapping[str, str]) -> Response:
        return self.respond({"challenge": data["challenge"]})

    def prompt_link(self, slack_request: SlackDMRequest) -> None:
        associate_url = build_linking_url(
            integration=slack_request.integration,
            slack_id=slack_request.user_id,
            channel_id=slack_request.channel_id,
            response_url=slack_request.response_url,
        )
        if not slack_request.channel_name:
            return

        payload = {
            "token": self._get_access_token(slack_request.integration),
            "channel": slack_request.channel_name,
            "user": slack_request.user_id,
            "text": "Link your Slack identity to Sentry to unfurl Discover charts.",
            **SlackPromptLinkMessageBuilder(associate_url).as_payload(),
        }

        client = SlackClient()
        try:
            client.post("/chat.postEphemeral", data=payload)
        except ApiError as e:
            logger.error("slack.event.unfurl-error", extra={"error": str(e)}, exc_info=True)

    def on_message(self, request: Request, slack_request: SlackDMRequest) -> Response:
        command = request.data.get("event", {}).get("text", "").lower()
        if slack_request.is_bot() or not command:
            return self.respond()

        headers = {"Authorization": f"Bearer {self._get_access_token(slack_request.integration)}"}
        payload = {
            "channel": slack_request.channel_name,
            **SlackHelpMessageBuilder(command).as_payload(),
        }
        client = SlackClient()
        try:
            client.post("/chat.postMessage", headers=headers, data=payload, json=True)
        except ApiError as e:
            logger.error("slack.event.on-message-error", extra={"error": str(e)})

        return self.respond()

    def on_link_shared(self, request: Request, slack_request: SlackDMRequest) -> bool:
        """Returns true on success"""
        matches: MutableMapping[LinkType, list[UnfurlableUrl]] = defaultdict(list)
        links_seen = set()

        data = slack_request.data.get("event", {})

        # An unfurl may have multiple links to unfurl
        for item in data.get("links", []):
            try:
                url = item["url"]
                slack_shared_link = parse_link(url)
            except Exception as e:
                logger.error("slack.parse-link-error", extra={"error": str(e)})
                continue

            # We would like to track what types of links users are sharing, but
            # it's a little difficult to do in Sentry because we filter requests
            # from Slack bots. Instead we just log to Kibana.
            logger.info("slack.link-shared", extra={"slack_shared_link": slack_shared_link})
            link_type, args = match_link(url)

            # Link can't be unfurled
            if link_type is None or args is None:
                continue

            organization = slack_request.integration.organizations.first()
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
            seen_marker = hash(json.dumps((link_type, args), sort_keys=True))
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

        access_token = self._get_access_token(slack_request.integration)

        payload = {
            "token": access_token,
            "channel": data["channel"],
            "ts": data["message_ts"],
            "unfurls": json.dumps(results),
        }

        client = SlackClient()
        try:
            client.post("/chat.unfurl", data=payload)
        except ApiError as e:
            logger.error("slack.event.unfurl-error", extra={"error": str(e)}, exc_info=True)

        return True

    # TODO(dcramer): implement app_uninstalled and tokens_revoked
    @transaction_start("SlackEventEndpoint")
    def post(self, request: Request) -> Response:
        try:
            slack_request = SlackEventRequest(request)
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
