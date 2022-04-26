from __future__ import annotations

import logging
from functools import reduce
from typing import Any, Mapping, Sequence
from urllib.parse import quote

from jwt import ExpiredSignatureError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import StreamGroupSerializer
from sentry.integrations.utils import AtlassianConnectValidationError, get_integration_from_request
from sentry.models import ExternalIssue, Group
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.http import absolute_uri
from sentry.utils.sdk import configure_scope

from ..utils import handle_jira_api_error, set_badge
from . import UNABLE_TO_VERIFY_INSTALLATION, JiraBaseHook

logger = logging.getLogger(__name__)


# TODO: find more efficient way of getting stats
def get_serialized_and_stats(group: Group, stats_period: str) -> tuple[Mapping[str, Any], int]:
    result = serialize(
        group,
        None,
        StreamGroupSerializer(stats_period=stats_period),
    )
    stats = reduce(
        lambda x, y: x + y[1],
        result["stats"][stats_period],
        0,
    )

    return result, stats


def get_release_url(group: Group, release: str) -> str:
    project = group.project
    return absolute_uri(
        "/organizations/{}/releases/{}/?project={}".format(
            project.organization.slug, quote(release), project.id
        )
    )


def build_context(group: Group) -> Mapping[str, Any]:
    result, stats_24hr = get_serialized_and_stats(group, "24h")
    _, stats_14d = get_serialized_and_stats(group, "14d")

    first_release = group.get_first_release()
    if first_release is not None:
        last_release = group.get_last_release()
    else:
        last_release = None

    first_release_url = None
    if first_release:
        first_release_url = get_release_url(group, first_release)

    last_release_url = None
    if last_release:
        last_release_url = get_release_url(group, last_release)

    group_url = group.get_absolute_url(params={"referrer": "sentry-issues-glance"})

    return {
        "type": result.get("metadata", {}).get("type", "Unknown Error"),
        "title": group.title,
        "title_url": group_url,
        "first_seen": result["firstSeen"],
        "last_seen": result["lastSeen"],
        "first_release": first_release,
        "first_release_url": first_release_url,
        "last_release": last_release,
        "last_release_url": last_release_url,
        "stats_24hr": stats_24hr,
        "stats_14d": stats_14d,
    }


class JiraIssueHookView(JiraBaseHook):
    html_file = "sentry/integrations/jira-issue.html"

    def handle_groups(self, groups: Sequence[Group]) -> Response:
        response_context = {"groups": []}
        for group in groups:
            context = build_context(group)
            response_context["groups"].append(context)

        logger.info(
            "issue_hook.response",
            extra={"issue_count": len(groups)},
        )

        return self.get_response(response_context)

    def dispatch(self, request: Request, *args, **kwargs) -> Response:
        try:
            return super().dispatch(request, *args, **kwargs)
        except ApiError as exc:
            # Sometime set_badge() will fail to connect.
            response_option = handle_jira_api_error(exc, " to set badge")
            if response_option:
                return self.get_response(response_option)
            raise exc

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
                organization = integration.organizations.filter(
                    id=external_issue.organization_id
                ).first()
                groups = Group.objects.get_groups_by_external_issue(
                    integration=integration,
                    organizations=[organization],
                    external_issue_key=issue_key,
                )
            except (
                ExternalIssue.DoesNotExist,
                # Multiple ExternalIssues are returned if organizations share one integration.
                # Since we cannot identify the organization from the request alone, for now, we just
                # avoid crashing on the MultipleObjectsReturned error.
                ExternalIssue.MultipleObjectsReturned,
            ) as e:
                scope.set_tag("failure", e.__class__.__name__)
                set_badge(integration, issue_key, 0)
                return self.get_response({"issue_not_linked": True})

            scope.set_tag("organization.slug", organization.slug)
            response = self.handle_groups(groups)
            scope.set_tag("status_code", response.status_code)

            set_badge(integration, issue_key, len(groups))
            return response
