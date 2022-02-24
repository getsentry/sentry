import logging
from functools import reduce
from urllib.parse import quote

from jwt import ExpiredSignatureError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.serializers import StreamGroupSerializer, serialize
from sentry.integrations.utils import AtlassianConnectValidationError, get_integration_from_request
from sentry.models import ExternalIssue, Group, GroupLink
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.utils.http import absolute_uri
from sentry.utils.sdk import configure_scope

from ..utils import set_badge
from . import UNABLE_TO_VERIFY_INSTALLATION, JiraBaseHook

logger = logging.getLogger(__name__)


def accum(tot, item):
    return tot + item[1]


class JiraIssueHookView(JiraBaseHook):
    html_file = "sentry/integrations/jira-issue.html"

    def handle_exception(self, request: Request, exc: Exception) -> Response:
        # Sometime set_badge() will fail to connect.
        if isinstance(exc, IntegrationError):
            return self.get_response({"error_message": str(exc)})
        return super().handle_exception(request, exc)

    def get(self, request: Request, issue_key, *args, **kwargs) -> Response:
        with configure_scope() as scope:
            try:
                integration = get_integration_from_request(request, "jira")
            except AtlassianConnectValidationError:
                scope.set_tag("failure", "AtlassianConnectValidationError")
                return self.get_response({"error_message": UNABLE_TO_VERIFY_INSTALLATION})
            except ExpiredSignatureError:
                scope.set_tag("failure", "ExpiredSignatureError")
                return self.get_response({"refresh_required": True})

            try:
                external_issue = ExternalIssue.objects.get(
                    integration_id=integration.id, key=issue_key
                )
                # TODO: handle multiple
                group_link = GroupLink.objects.filter(
                    linked_type=GroupLink.LinkedType.issue,
                    linked_id=external_issue.id,
                    relationship=GroupLink.Relationship.references,
                ).first()
                if not group_link:
                    raise GroupLink.DoesNotExist()
                group = Group.objects.get(id=group_link.group_id)
            except (ExternalIssue.DoesNotExist, GroupLink.DoesNotExist, Group.DoesNotExist) as e:
                scope.set_tag("failure", e.__class__.__name__)
                set_badge(integration, issue_key, 0)
                return self.get_response({"issue_not_linked": True})
            scope.set_tag("organization.slug", group.organization.slug)

            # TODO: find more efficient way of getting stats
            def get_serialized_and_stats(stats_period):
                result = serialize(
                    group,
                    None,
                    StreamGroupSerializer(stats_period=stats_period),
                )
                stats = result["stats"][stats_period]
                return result, reduce(accum, stats, 0)

            def get_release_url(release):
                project = group.project
                return absolute_uri(
                    "/organizations/{}/releases/{}/?project={}".format(
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

            logger.info(
                "issue_hook.response",
                extra={"type": context["type"], "title_url": context["title_url"]},
            )
            result = self.get_response(context)
            scope.set_tag("status_code", result.status_code)

            # XXX(CEO): group_link_num is hardcoded as 1 now, but when we handle
            #  displaying multiple linked issues this should be updated to the
            #  actual count.
            set_badge(integration, issue_key, 1)
            return result
