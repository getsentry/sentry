from __future__ import absolute_import

import re
import six
from collections import defaultdict

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
from .utils import build_group_attachment, build_incident_attachment, logger

# XXX(dcramer): this could be more tightly bound to our configured domain,
# but slack limits what we can unfurl anyways so its probably safe
_link_regexp = re.compile(
    r"^https?\://[^/]+/[^/]+/[^/]+/(issues|incidents)/(\d+)(?:/events/(\w+))?"
)
_org_slug_regexp = re.compile(r"^https?\://[^/]+/organizations/([^/]+)/")


def unfurl_issues(integration, url_by_issue_id, event_id_by_url=None):
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
            id__in=set(url_by_issue_id.keys()),
            project__in=Project.objects.filter(organization__in=integration.organizations.all()),
        )
    }
    if not group_by_id:
        return {}

    out = {}
    for issue_id, url in six.iteritems(url_by_issue_id):
        if issue_id in group_by_id:
            group = group_by_id[issue_id]
            # lookup the event by the id
            event_id = event_id_by_url.get(url)
            event = eventstore.get_event_by_id(group.project_id, event_id) if event_id else None
            out[url] = build_group_attachment(
                group_by_id[issue_id], event=event, link_to_event=True
            )
    return out


def unfurl_incidents(integration, incident_map, event_id_by_url=None):
    filter_query = Q()
    # Since we don't have real ids here, we have to also extract the org slug
    # from the url so that we can make sure the identifiers correspond to the
    # correct organization.
    for identifier, url in six.iteritems(incident_map):
        org_slug = _org_slug_regexp.match(url).group(1)
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
        v: build_incident_attachment(results[k])
        for k, v in six.iteritems(incident_map)
        if k in results
    }


# XXX(dcramer): a lot of this is copied from sentry-plugins right now, and will
# need refactored
class SlackEventEndpoint(Endpoint):
    event_handlers = {"issues": unfurl_issues, "incidents": unfurl_incidents}

    authentication_classes = ()
    permission_classes = ()

    def _parse_url(self, link):
        """
        Extracts event type, issue id, and event id from a url.
        :param link: Url to parse to information from
        :return: If successful, a tuple containing the event_type, issue id, and event id.
        The event ID is optional and will be None if the link isn't to an event
        If we were unsuccessful at matching, a tuple containing three None values
        """
        match = _link_regexp.match(link)
        if not match:
            return None, None, None
        try:
            if len(match.groups()) > 2:
                return match.group(1), int(match.group(2)), match.group(3)
            else:
                return match.group(1), int(match.group(2)), None
        except (TypeError, ValueError):
            return None, None, None

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
            logger.error("slack.event.on-message-error", extra={"error": six.text_type(e)})

        return self.respond()

    def on_link_shared(self, request, integration, token, data):
        parsed_issues = defaultdict(dict)
        event_id_by_url = {}
        for item in data["links"]:
            event_type, instance_id, event_id = self._parse_url(item["url"])
            if not instance_id:
                continue
            # note that because we store the url by the issue,
            # we will only unfurl one link per issue even if there are
            # multiple links to different events
            parsed_issues[event_type][instance_id] = item["url"]
            event_id_by_url[item["url"]] = event_id

        if not parsed_issues:
            return

        results = {}
        for event_type, instance_map in parsed_issues.items():
            results.update(
                self.event_handlers[event_type](integration, instance_map, event_id_by_url)
            )

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
            logger.error("slack.event.unfurl-error", extra={"error": six.text_type(e)})

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
