import re
from typing import List

from django.http.request import HttpRequest

from sentry import eventstore
from sentry.integrations.slack.message_builder.issues import build_group_attachment
from sentry.models import Group, Integration, Project

from . import Handler, UnfurlableUrl, UnfurledUrl, make_type_coercer

map_issue_args = make_type_coercer(
    {
        "issue_id": int,
        "event_id": str,
    }
)


def unfurl_issues(
    request: HttpRequest, integration: Integration, links: List[UnfurlableUrl]
) -> UnfurledUrl:
    """
    Returns a map of the attachments used in the response we send to Slack
    for a particular issue by the URL of the yet-unfurled links a user included
    in their Slack message.
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


handler = Handler(
    fn=unfurl_issues,
    matcher=re.compile(
        r"^https?\://[^/]+/[^/]+/[^/]+/issues/(?P<issue_id>\d+)(?:/events/(?P<event_id>\w+))?"
    ),
    arg_mapper=map_issue_args,
)
