from __future__ import absolute_import


import logging

from jwt import ExpiredSignatureError
from six.moves import reduce
from six.moves.urllib.parse import quote


from sentry.api.serializers import serialize, StreamGroupSerializer
from sentry.integrations.atlassian_connect import (
    AtlassianConnectValidationError,
    get_integration_from_request,
)
from sentry.models import ExternalIssue, GroupLink, Group
from sentry.utils.http import absolute_uri
from sentry.web.decorators import transaction_start

from .base_hook import JiraBaseHook

logger = logging.getLogger(__name__)


def accum(tot, item):
    return tot + item[1]


class JiraIssueHookView(JiraBaseHook):
    html_file = "sentry/integrations/jira-issue.html"

    @transaction_start("JiraIssueHookView.get")
    def get(self, request, issue_key, *args, **kwargs):
        try:
            integration = get_integration_from_request(request, "jira")
        except AtlassianConnectValidationError:
            return self.get_response({"error_message": "Unable to verify installation."})
        except ExpiredSignatureError:
            return self.get_response({"refresh_required": True})

        try:
            external_issue = ExternalIssue.objects.get(integration_id=integration.id, key=issue_key)
            # TODO: handle multiple
            group_link = GroupLink.objects.filter(
                linked_type=GroupLink.LinkedType.issue,
                linked_id=external_issue.id,
                relationship=GroupLink.Relationship.references,
            ).first()
            if not group_link:
                raise GroupLink.DoesNotExist()
            group = Group.objects.get(id=group_link.group_id)
        except (ExternalIssue.DoesNotExist, GroupLink.DoesNotExist, Group.DoesNotExist):
            return self.get_response({"issue_not_linked": True})

        # TODO: find more effecient way of getting stats
        def get_serialized_and_stats(stats_period):
            result = serialize(group, None, StreamGroupSerializer(stats_period=stats_period),)
            stats = result["stats"][stats_period]
            return result, reduce(accum, stats, 0)

        def get_release_url(release):
            project = group.project
            return absolute_uri(
                u"/organizations/{}/releases/{}/?project={}".format(
                    project.organization.slug, quote(release), project.id
                )
            )

        def get_group_url(group):
            return group.get_absolute_url(params={"referrer": "sentry-issues-glance"})

        result, stats_24hr = get_serialized_and_stats("24h")
        _, stats_14d = get_serialized_and_stats("14d")

        first_release = group.get_first_release()
        if first_release is not None:
            last_release = group.get_last_release()
        else:
            last_release = None

        first_release_url = None
        if first_release:
            first_release_url = get_release_url(first_release)

        last_release_url = None
        if last_release:
            last_release_url = get_release_url(last_release)

        context = {
            "type": result.get("metadata", {}).get("type", "Unknown Error"),
            "title": group.title,
            "title_url": get_group_url(group),
            "first_seen": result["firstSeen"],
            "last_seen": result["lastSeen"],
            "first_release": first_release,
            "first_release_url": first_release_url,
            "last_release": last_release,
            "last_release_url": last_release_url,
            "stats_24hr": stats_24hr,
            "stats_14d": stats_14d,
        }

        logger.info("issue_hook.response", extra=context)

        return self.get_response(context)
