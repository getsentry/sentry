from collections import defaultdict
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features
from sentry.integrations.slack.client import SlackClient
from sentry.integrations.slack.message_builder.base.block import BlockSlackMessageBuilder
from sentry.integrations.slack.message_builder.event import SlackEventMessageBuilder
from sentry.integrations.slack.requests.base import SlackRequest, SlackRequestError
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


class SlackEventEndpoint(SlackDMEndpoint):  # type: ignore
    """
    XXX(dcramer): a lot of this is copied from sentry-plugins right now, and will need refactoring
    """

    authentication_classes = ()
    permission_classes = ()

    def is_bot(self, data: Mapping[str, Any]) -> bool:
        """
        If it's a message posted by our bot, we don't want to respond since that
        will cause an infinite loop of messages.
        """
        return bool(data.get("bot_id"))

    def get_command_and_args(self, slack_request: SlackRequest) -> Tuple[str, Sequence[str]]:
        data = slack_request.data.get("event")
        command = data["text"].lower().split()
        return command[0], command[1:]

    def reply(self, slack_request: SlackRequest, message: str) -> Response:
        client = SlackClient()
        access_token = self._get_access_token(slack_request.integration)
        headers = {"Authorization": f"Bearer {access_token}"}
        data = slack_request.data.get("event")
        channel = data["channel"]
        payload = {"channel": channel, "text": message}

        try:
            client.post("/chat.postMessage", headers=headers, data=payload, json=True)
        except ApiError as e:
            logger.error("slack.event.on-message-error", extra={"error": str(e)})

        return self.respond()

    def link_team(self, slack_request: SlackRequest) -> Any:
        return self.reply(slack_request, LINK_FROM_CHANNEL_MESSAGE)

    def unlink_team(self, slack_request: SlackRequest) -> Any:
        return self.reply(slack_request, LINK_FROM_CHANNEL_MESSAGE)

    def _get_access_token(self, integration: Integration) -> Any:
        # the classic bot tokens must use the user auth token for URL unfurling
        # we stored the user_access_token there
        # but for workspace apps and new slack bot tokens, we can just use access_token
        return integration.metadata.get("user_access_token") or integration.metadata["access_token"]

    def on_url_verification(self, request: Request, data: Mapping[str, str]) -> Response:
        return self.respond({"challenge": data["challenge"]})

    def prompt_link(
        self,
        data: Mapping[str, Any],
        slack_request: SlackRequest,
        integration: Integration,
    ):
        # This will break if multiple Sentry orgs are added
        # to a single Slack workspace and a user is a part of one
        # org and not the other. Since we pick the first org
        # in the integration organizations set, we might be picking
        # the org the user is not a part of.
        organization = integration.organizations.all()[0]
        associate_url = build_linking_url(
            integration=integration,
            organization=organization,
            slack_id=slack_request.user_id,
            channel_id=slack_request.channel_id,
            response_url=slack_request.response_url,
        )

        builder = BlockSlackMessageBuilder()

        blocks = [
            builder.get_markdown_block(
                "Link your Slack identity to Sentry to unfurl Discover charts."
            ),
            builder.get_action_block([("Link", associate_url, "link"), ("Cancel", None, "ignore")]),
        ]

        payload = {
            "token": self._get_access_token(integration),
            "channel": data["channel"],
            "user": data["user"],
            "text": "Link your Slack identity to Sentry to unfurl Discover charts.",
            "blocks": json.dumps(blocks),
        }

        client = SlackClient()
        try:
            client.post("/chat.postEphemeral", data=payload)
        except ApiError as e:
            logger.error("slack.event.unfurl-error", extra={"error": str(e)}, exc_info=True)

    def on_message(
        self, request: Request, integration: Integration, token: str, data: Mapping[str, Any]
    ) -> Response:
        channel = data["channel"]
        command = request.data.get("event", {}).get("text", "").lower()
        if self.is_bot(data) or not command:
            return self.respond()
        access_token = self._get_access_token(integration)
        headers = {"Authorization": f"Bearer {access_token}"}
        payload = {"channel": channel, **SlackEventMessageBuilder(integration, command).build()}
        client = SlackClient()
        try:
            client.post("/chat.postMessage", headers=headers, data=payload, json=True)
        except ApiError as e:
            logger.error("slack.event.on-message-error", extra={"error": str(e)})

        return self.respond()

    def on_link_shared(
        self,
        request: Request,
        slack_request: SlackRequest,
    ) -> Optional[Response]:
        matches: Dict[LinkType, List[UnfurlableUrl]] = defaultdict(list)
        links_seen = set()

        integration = slack_request.integration
        data = slack_request.data.get("event")

        # An unfurl may have multiple links to unfurl
        for item in data["links"]:
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

            if (
                link_type == LinkType.DISCOVER
                and not slack_request.has_identity
                and features.has(
                    "organizations:chart-unfurls",
                    slack_request.integration.organizations.all()[0],
                    actor=request.user,
                )
            ):
                analytics.record(
                    "integrations.slack.chart_unfurl",
                    organization_id=integration.organizations.all()[0].id,
                    unfurls_count=0,
                )
                self.prompt_link(data, slack_request, integration)
                return self.respond()

            # Don't unfurl the same thing multiple times
            seen_marker = hash(json.dumps((link_type, args), sort_keys=True))
            if seen_marker in links_seen:
                continue

            links_seen.add(seen_marker)
            matches[link_type].append(UnfurlableUrl(url=url, args=args))

        if not matches:
            return None

        # Unfurl each link type
        results: Dict[str, Any] = {}
        for link_type, unfurl_data in matches.items():
            results.update(
                link_handlers[link_type].fn(request, integration, unfurl_data, slack_request.user)
            )

        if not results:
            return None

        access_token = self._get_access_token(integration)

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

        return self.respond()

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
            resp = self.on_link_shared(
                request,
                slack_request,
            )

            if resp:
                return resp

        if slack_request.type == "message":
            data = slack_request.data.get("event")
            if self.is_bot(data):
                return self.respond()

            command = data.get("text")
            if command in COMMANDS:
                resp = super().post_dispatcher(slack_request)

            else:
                resp = self.on_message(
                    request,
                    slack_request.integration,
                    slack_request.data.get("token"),
                    slack_request.data.get("event"),
                )

            if resp:
                return resp

        return self.respond()
