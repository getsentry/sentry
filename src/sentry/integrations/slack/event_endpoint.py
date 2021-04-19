from collections import defaultdict
from typing import Any, Dict, List

from sentry.api.base import Endpoint
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import json
from sentry.web.decorators import transaction_start

from .client import SlackClient
from .requests import SlackEventRequest, SlackRequestError
from .unfurl import LinkType, UnfurlableUrl, link_handlers, match_link
from .utils import logger, parse_link


# XXX(dcramer): a lot of this is copied from sentry-plugins right now, and will
# need refactored
class SlackEventEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    def _get_access_token(self, integration):
        # the classic bot tokens must use the user auth token for URL unfurling
        # we stored the user_access_token there
        # but for workspace apps and new slack bot tokens, we can just use access_token
        return integration.metadata.get("user_access_token") or integration.metadata["access_token"]

    def on_url_verification(self, request, data):
        return self.respond({"challenge": data["challenge"]})

    def on_message(self, request, integration, token, data):
        channel = data["channel"]
        # if it's a message posted by our bot, we don't want to respond since
        # that will cause an infinite loop of messages
        if data.get("bot_id"):
            return self.respond()

        access_token = self._get_access_token(integration)

        headers = {"Authorization": "Bearer %s" % access_token}
        payload = {
            "channel": channel,
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "Want to learn more about configuring alerts in Sentry? Check out our documentation.",
                    },
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {"type": "plain_text", "text": "Sentry Docs"},
                            "url": "https://docs.sentry.io/product/alerts-notifications/alerts/",
                            "value": "sentry_docs_link_clicked",
                        }
                    ],
                },
            ],
        }

        client = SlackClient()
        try:
            client.post("/chat.postMessage", headers=headers, data=payload, json=True)
        except ApiError as e:
            logger.error("slack.event.on-message-error", extra={"error": str(e)})

        return self.respond()

    def on_link_shared(self, request, integration, token, data):
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
            return

        # Unfurl each link type
        results: Dict[str, Any] = {}
        for link_type, unfurl_data in matches.items():
            results.update(link_handlers[link_type].fn(request, integration, unfurl_data))

        if not results:
            return

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
    def post(self, request):
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
            resp = self.on_message(
                request,
                slack_request.integration,
                slack_request.data.get("token"),
                slack_request.data.get("event"),
            )

            if resp:
                return resp

        return self.respond()
