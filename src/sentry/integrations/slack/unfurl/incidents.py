import re
from typing import List

from django.db.models import Q
from django.http.request import HttpRequest

from sentry.incidents.models import Incident
from sentry.integrations.slack.message_builder.incidents import build_incident_attachment
from sentry.models.integration import Integration

from . import Handler, UnfurlableUrl, UnfurledUrl, make_type_coercer

map_incident_args = make_type_coercer(
    {
        "org_slug": str,
        "incident_id": int,
    }
)


def unfurl_incidents(
    request: HttpRequest, integration: Integration, links: List[UnfurlableUrl]
) -> UnfurledUrl:
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


handler = Handler(
    fn=unfurl_incidents,
    matcher=re.compile(
        r"^https?\://[^/]+/organizations/(?P<org_slug>[^/]+)/alerts/rules/details/(?P<incident_id>\d+)"
    ),
    arg_mapper=map_incident_args,
)
