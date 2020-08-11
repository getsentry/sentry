from __future__ import absolute_import

import re
import six
from collections import defaultdict

from django.db.models import Q

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
_link_regexp = re.compile(r"^https?\://[^/]+/[^/]+/[^/]+/(issues|incidents)/(\d+)")
_org_slug_regexp = re.compile(r"^https?\://[^/]+/organizations/([^/]+)/")


def unfurl_issues(integration, issue_map):
    results = {
        g.id: g
        for g in Group.objects.filter(
            id__in=set(issue_map.keys()),
            project__in=Project.objects.filter(organization__in=integration.organizations.all()),
        )
    }
    if not results:
        return {}

    return {
        v: build_group_attachment(results[k]) for k, v in six.iteritems(issue_map) if k in results
    }


def unfurl_incidents(integration, incident_map):
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
        Extracts event type and id from a url.
        :param link: Url to parse to information from
        :return: If successful, a tuple containing the event_type and id. If we
        were unsuccessful at matching, a tuple containing two None values
        """
        match = _link_regexp.match(link)
        if not match:
            return None, None
        try:
            return match.group(1), int(match.group(2))
        except (TypeError, ValueError):
            return None, None

    def on_url_verification(self, request, data):
        return self.respond({"challenge": data["challenge"]})

    def on_link_shared(self, request, integration, token, data):
        parsed_events = defaultdict(dict)
        for item in data["links"]:
            event_type, instance_id = self._parse_url(item["url"])
            if not instance_id:
                continue
            parsed_events[event_type][instance_id] = item["url"]

        if not parsed_events:
            return

        results = {}
        for event_type, instance_map in parsed_events.items():
            results.update(self.event_handlers[event_type](integration, instance_map))

        if not results:
            return

        # the classic bot tokens must use the user auth token for URL unfurling
        # we stored the user_access_token there
        # but for workspace apps and new slack bot tokens, we can just use access_token
        access_token = integration.metadata.get("user_access_token")
        if not access_token:
            access_token = integration.metadata["access_token"]

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

        return self.respond()
