from collections import defaultdict
from typing import Any, Dict, List, Mapping, Optional
from urllib.parse import urlencode

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import Endpoint
from sentry.integrations.slack.client import SlackClient
from sentry.integrations.slack.message_builder.disconnected import SlackDisconnectedMessageBuilder
from sentry.integrations.slack.message_builder.event import SlackEventMessageBuilder
from sentry.integrations.slack.requests.base import SlackRequestError
from sentry.integrations.slack.requests.command import SlackCommandRequest
from sentry.integrations.slack.requests.event import SlackEventRequest
from sentry.integrations.slack.unfurl import LinkType, UnfurlableUrl, link_handlers, match_link
from sentry.integrations.slack.views.link_identity import build_linking_url
from sentry.integrations.slack.views.unlink_identity import build_unlinking_url
from sentry.models import Integration
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import json
from sentry.web.decorators import transaction_start

from ..utils import logger, parse_link


# XXX(dcramer): a lot of this is copied from sentry-plugins right now, and will
# need refactored
class SlackEventEndpoint(Endpoint):  # type: ignore
    authentication_classes = ()
    permission_classes = ()

    def _get_access_token(self, integration: Integration) -> str:
        # the classic bot tokens must use the user auth token for URL unfurling
        # we stored the user_access_token there
        # but for workspace apps and new slack bot tokens, we can just use access_token
        return integration.metadata.get("user_access_token") or integration.metadata["access_token"]

    def on_url_verification(self, request: Request, data: Mapping[str, str]) -> Response:
        return self.respond({"challenge": data["challenge"]})

    def on_message(
        self, request: Request, integration: Integration, token: str, data: Mapping[str, Any]
    ) -> Response:
        channel = data["channel"]
        # if it's a message posted by our bot, we don't want to respond since
        # that will cause an infinite loop of messages
        if data.get("bot_id"):
            return self.respond()
        access_token = self._get_access_token(integration)
        headers = {"Authorization": "Bearer %s" % access_token}
        payload = {"channel": channel, **SlackEventMessageBuilder(integration).build()}
        client = SlackClient()
        try:
            client.post("/chat.postMessage", headers=headers, data=payload, json=True)
        except ApiError as e:
            logger.error("slack.event.on-message-error", extra={"error": str(e)})

        return self.respond()

    def on_command(
        self, request: Request, message: str, integration: Integration, data: Mapping[str, Any]
    ) -> Response:

        from .command import (
            ALREADY_LINKED_MESSAGE,
            LINK_FROM_CHANNEL_MESSAGE,
            LINK_USER_MESSAGE,
            NOT_LINKED_MESSAGE,
            UNLINK_USER_MESSAGE,
        )

        access_token = self._get_access_token(integration)
        headers = {"Authorization": "Bearer %s" % access_token}
        channel = data["channel"]
        client = SlackClient()
        organization = integration.organizations.all()[0]
        if not features.has("organizations:notification-platform", organization):
            payload = {"channel": channel, **SlackEventMessageBuilder(integration).build()}
            try:
                client.post("/chat.postMessage", headers=headers, data=payload, json=True)
            except ApiError as e:
                logger.error("slack.event.on-message-error", extra={"error": str(e)})

            return
        # do some data massaging to get it in the right format
        formatted_body = json.loads(request.body)
        formatted_body["user_id"] = formatted_body["event"]["user"]
        formatted_body = urlencode(formatted_body)
        request.body = formatted_body.encode("utf-8")
        payload = {"channel": channel}
        try:
            slack_request = SlackCommandRequest(request)
            slack_request.validate()
        except SlackRequestError as e:
            if e.status == status.HTTP_403_FORBIDDEN:
                return self.respond(SlackDisconnectedMessageBuilder().build())
            return self.respond(status=e.status)

        if message == "link team" or message == "unlink team":
            payload["text"] = LINK_FROM_CHANNEL_MESSAGE
            try:
                client.post("/chat.postMessage", headers=headers, data=payload, json=True)
            except ApiError as e:
                logger.error("slack.event.on-message-error", extra={"error": str(e)})

            return

        if message == "link":
            if slack_request.has_identity:
                payload["text"] = ALREADY_LINKED_MESSAGE.format(username=slack_request.identity_str)
                try:
                    client.post("/chat.postMessage", headers=headers, data=payload, json=True)
                except ApiError as e:
                    logger.error("slack.event.on-message-error", extra={"error": str(e)})

                return

            associate_url = build_linking_url(
                integration=integration,
                organization=organization,
                slack_id=slack_request.user_id,
                channel_id=slack_request.channel_id,
                response_url=slack_request.response_url,
            )
            payload["text"] = LINK_USER_MESSAGE.format(associate_url=associate_url)
            try:
                client.post("/chat.postMessage", headers=headers, data=payload, json=True)
            except ApiError as e:
                logger.error("slack.event.on-message-error", extra={"error": str(e)})
            return

        if message == "unlink":
            if not slack_request.has_identity:
                payload["text"] = NOT_LINKED_MESSAGE
                try:
                    client.post("/chat.postMessage", headers=headers, data=payload, json=True)
                except ApiError as e:
                    logger.error("slack.event.on-message-error", extra={"error": str(e)})

                return

            associate_url = build_unlinking_url(
                integration_id=integration.id,
                organization_id=organization.id,
                slack_id=slack_request.user_id,
                channel_id=slack_request.channel_id,
                response_url=slack_request.response_url,
            )
            payload["text"] = UNLINK_USER_MESSAGE.format(associate_url=associate_url)
            try:
                client.post("/chat.postMessage", headers=headers, data=payload, json=True)
            except ApiError as e:
                logger.error("slack.event.on-message-error", extra={"error": str(e)})

            return

        return

    def on_link_shared(
        self, request: Request, integration: Integration, token: str, data: Mapping[str, Any]
    ) -> Optional[Response]:
        matches: Dict[LinkType, List[UnfurlableUrl]] = defaultdict(list)
        links_seen = set()
        # An unfurl may have multiple links to unfurl
        for item in data["links"]:
            try:
                # We would like to track what types of links users are sharing,
                # but it's a little difficult to do in sentry since we filter
                # requests from Slack bots. Instead we just log to Kibana
                logger.info(
                    "slack.link-shared", extra={"slack_shared_link": parse_link(item["url"])}
                )
            except Exception as e:
                logger.error("slack.parse-link-error", extra={"error": str(e)})

            link_type, args = match_link(item["url"])

            # Link can't be unfurled
            if link_type is None or args is None:
                continue

            # Don't unfurl the same thing multiple times
            seen_marker = hash(json.dumps((link_type, args), sort_keys=True))
            if seen_marker in links_seen:
                continue

            links_seen.add(seen_marker)
            matches[link_type].append(UnfurlableUrl(url=item["url"], args=args))

        if not matches:
            return None

        # Unfurl each link type
        results: Dict[str, Any] = {}
        for link_type, unfurl_data in matches.items():
            results.update(link_handlers[link_type].fn(request, integration, unfurl_data))

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
                slack_request.integration,
                slack_request.data.get("token"),
                slack_request.data.get("event"),
            )

            if resp:
                return resp

        if slack_request.type == "message":
            COMMANDS = ["link", "unlink", "link team", "unlink team"]
            data = slack_request.data.get("event")
            message = data["text"]
            if message in COMMANDS:
                resp = self.on_command(
                    request,
                    message,
                    slack_request.integration,
                    slack_request.data.get("event"),
                )
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
