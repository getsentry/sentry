import enum
import re
from collections import defaultdict
from typing import (
    Any,
    Callable,
    DefaultDict,
    Dict,
    List,
    Mapping,
    Match,
    NamedTuple,
    Pattern,
    Tuple,
    Union,
)

from django.db.models import Q

from sentry import eventstore
from sentry.api.base import Endpoint
from sentry.incidents.models import Incident
from sentry.models import Group, Project
from sentry.shared_integrations.exceptions import ApiError
from sentry.web.decorators import transaction_start
from sentry.utils import json

from .client import SlackClient
from .requests import SlackEventRequest, SlackRequestError
from .utils import build_group_attachment, build_incident_attachment, parse_link, logger

UnfurledUrl = Any


class LinkType(enum.Enum):
    ISSUES = "issues"
    INCIDENTS = "incidents"
    DISCOVER = "discover"


class UnfurlableUrl(NamedTuple):
    url: str
    args: Mapping[str, Any]


class Handler(NamedTuple):
    matcher: Pattern
    arg_types: Mapping[str, type]
    fn: Callable[[Any, List[UnfurlableUrl]], UnfurledUrl]


def unfurl_issues(integration, links: List[UnfurlableUrl]) -> UnfurledUrl:
    """
    Returns a map of the attachments used in the response we send to Slack
    for a particular issue by the URL of the yet-unfurled links a user included
    in their Slack message.

    url_by_issue_id: a map with URL as the value and the issue ID as the key
    event_id_by_url: a map with the event ID in a URL as the value and the URL as the key
    """
    group_by_id = {
        g.id: g
        for g in Group.objects.filter(
            id__in={link.args["issue_id"] for link in links},
            project__in=Project.objects.filter(organization__in=integration.organizations.all()),
        )
    }
    if not group_by_id:
        return {}

    out = {}
    for link in links:
        issue_id = link.args["issue_id"]

        if issue_id in group_by_id:
            group = group_by_id[issue_id]
            # lookup the event by the id
            event_id = link.args["event_id"]
            event = eventstore.get_event_by_id(group.project_id, event_id) if event_id else None
            out[link.url] = build_group_attachment(
                group_by_id[issue_id], event=event, link_to_event=True
            )
    return out


def unfurl_incidents(integration, links: List[UnfurlableUrl]) -> UnfurledUrl:
    filter_query = Q()
    # Since we don't have real ids here, we use the org slug so that we can
    # make sure the identifiers correspond to the correct organization.
    for link in links:
        identifier = link.args["incident_id"]
        org_slug = link.args["org_slug"]
        filter_query |= Q(identifier=identifier, organization__slug=org_slug)

    results = {
        i.identifier: i
        for i in Incident.objects.filter(
            filter_query,
            # Filter by integration organization here as well to make sure that
            # we have permission to access these incidents.
            organization__in=integration.organizations.all(),
        )
    }
    if not results:
        return {}

    return {
        link.url: build_incident_attachment(
            action=None,
            incident=results[link.args["incident_id"]],
        )
        for link in links
        if link.args["incident_id"] in results
    }


# XXX: The regex matchers could be more tightly bound to our configured domain,
# but slack limits what we can unfurl anyways so its probably safe
_link_handlers = {
    LinkType.ISSUES: Handler(
        fn=unfurl_issues,
        matcher=re.compile(
            r"^https?\://[^/]+/[^/]+/[^/]+/issues/(?P<issue_id>\d+)(?:/events/(?P<event_id>\w+))?"
        ),
        arg_types={
            "issue_id": int,
            "event_id": str,
        },
    ),
    LinkType.INCIDENTS: Handler(
        fn=unfurl_incidents,
        matcher=re.compile(
            r"^https?\://[^/]+/organizations/(?P<org_slug>[^/]+)/incidents/(?P<incident_id>\d+)"
        ),
        arg_types={
            "org_slug": str,
            "incident_id": int,
        },
    ),
}


def match_link(link: str) -> Union[Tuple[LinkType, Match], Tuple[None, None]]:
    for link_type, handler in _link_handlers.items():
        match = handler.matcher.match(link)
        if match:
            return link_type, match
    return None, None


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

    def _parse_url(self, link) -> Union[Tuple[LinkType, Mapping[str, Any]], Tuple[None, None]]:
        """
        Determines if the URL is something we are able to unfurl, if it is we
        will return the named groups from the regex match, along with the link
        type.
        """
        link_type, match = match_link(link)

        if link_type is None or match is None:
            return None, None

        return link_type, match.groupdict()

    def on_link_shared(self, request, integration, token, data):
        matches: DefaultDict[LinkType, List[UnfurlableUrl]] = defaultdict(list)
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

            link_type, args = self._parse_url(item["url"])

            if not link_type or args is None:
                continue

            # Coerce link argument types
            arg_types = _link_handlers[link_type].arg_types
            clean_args = {k: arg_types[k](v) if v is not None else None for k, v in args.items()}

            # Don't unfurl the same thing multiple times
            seen_marker = (link_type, frozenset(args.items()))
            if seen_marker not in links_seen:
                links_seen.add(seen_marker)
            else:
                continue

            matches[link_type].append(UnfurlableUrl(url=item["url"], args=clean_args))

        if not matches:
            return

        # Unfurl each link type
        results: Dict[str, Any] = {}
        for link_type, unfurl_data in matches.items():
            results.update(_link_handlers[link_type].fn(integration, unfurl_data))

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
            logger.error("slack.event.unfurl-error", extra={"error": str(e)})

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
