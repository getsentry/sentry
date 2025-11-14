from __future__ import annotations

import logging
from collections.abc import Mapping
from functools import reduce
from typing import int, Any
from urllib.parse import quote

import sentry_sdk
from django.db.models.query import QuerySet
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from jwt import ExpiredSignatureError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.serializers import serialize
from sentry.api.serializers.models.group_stream import StreamGroupSerializer
from sentry.constants import ObjectStatus
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.utils.atlassian_connect import (
    AtlassianConnectValidationError,
    get_integration_from_request,
)
from sentry.issues.services.issue import issue_service
from sentry.issues.services.issue.model import RpcExternalIssueGroupMetadata
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.shared_integrations.exceptions import ApiError
from sentry.types.region import find_regions_for_orgs
from sentry.utils.http import absolute_uri
from sentry.web.frontend.base import control_silo_view, region_silo_view

from ..utils import handle_jira_api_error, set_badge
from . import UNABLE_TO_VERIFY_INSTALLATION, JiraSentryUIBaseView

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


def build_context(group: Group) -> dict[str, Any]:
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


@region_silo_view
class JiraSentryIssueDetailsView(JiraSentryUIBaseView):
    """
    Handles requests (from the Sentry integration in Jira) for HTML to display when you
    click on "Sentry -> Linked Issues" in the RH sidebar of an issue in the Jira UI.
    """

    html_file = "sentry/integrations/jira-issue.html"

    def handle_groups(self, groups: QuerySet[Group]) -> Response:
        response_context = {"groups": [build_context(group) for group in groups]}

        logger.info(
            "issue_hook.response",
            extra={"issue_count": len(groups)},
        )

        return self.get_response(response_context)

    def dispatch(self, request: HttpRequest, *args, **kwargs) -> HttpResponseBase:
        try:
            return super().dispatch(request, *args, **kwargs)
        except ApiError as exc:
            # Sometime set_badge() will fail to connect.
            response_option = handle_jira_api_error(exc, " to set badge")
            if response_option:
                return self.get_response(response_option)
            raise

    def get(self, request: Request, issue_key, *args, **kwargs) -> Response:
        scope = sentry_sdk.get_isolation_scope()

        try:
            integration = get_integration_from_request(request, "jira")
        except AtlassianConnectValidationError as e:
            scope.set_tag("failure", "AtlassianConnectValidationError")
            logger.info(
                "issue_hook.validation_error",
                extra={
                    "issue_key": issue_key,
                    "error": str(e),
                },
            )
            return self.get_response({"error_message": UNABLE_TO_VERIFY_INSTALLATION})
        except ExpiredSignatureError:
            scope.set_tag("failure", "ExpiredSignatureError")
            return self.get_response({"refresh_required": True})

        try:
            external_issue = ExternalIssue.objects.get(integration_id=integration.id, key=issue_key)
            organization = Organization.objects.get(id=external_issue.organization_id)
            if (
                integration_service.get_organization_integration(
                    organization_id=external_issue.organization_id,
                    integration_id=integration.id,
                )
                is None
            ):
                set_badge(integration, issue_key, 0)
                return self.get_response({"issue_not_linked": True})

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


@control_silo_view
class JiraSentryIssueDetailsControlView(JiraSentryUIBaseView):
    """
    Handles requests (from the Sentry integration in Jira) for HTML to display when you
    click on "Sentry -> Linked Issues" in the RH sidebar of an issue in the Jira UI.
    Fans the request to all regions and returns the groups from all regions.
    """

    html_file = "sentry/integrations/jira-issue-list.html"

    def handle_groups(self, groups: list[RpcExternalIssueGroupMetadata]) -> Response:
        response_context = {"groups": [dict(group) for group in groups]}

        logger.info(
            "issue_hook.response",
            extra={"issue_count": len(groups)},
        )

        return self.get_response(response_context)

    def dispatch(self, request: HttpRequest, *args, **kwargs) -> HttpResponseBase:
        try:
            return super().dispatch(request, *args, **kwargs)
        except ApiError as exc:
            # Sometime set_badge() will fail to connect.
            response_option = handle_jira_api_error(exc, " to set badge")
            if response_option:
                return self.get_response(response_option)
            raise

    def get(self, request: Request, issue_key, *args, **kwargs) -> Response:
        scope = sentry_sdk.get_isolation_scope()

        try:
            integration = get_integration_from_request(request, "jira")
        except AtlassianConnectValidationError as e:
            scope.set_tag("failure", "AtlassianConnectValidationError")
            logger.info(
                "issue_hook.validation_error",
                extra={
                    "issue_key": issue_key,
                    "error": str(e),
                },
            )
            return self.get_response({"error_message": UNABLE_TO_VERIFY_INSTALLATION})
        except ExpiredSignatureError:
            scope.set_tag("failure", "ExpiredSignatureError")
            return self.get_response({"refresh_required": True})

        has_groups = False
        groups = []
        organization_ids = list(
            OrganizationIntegration.objects.filter(
                integration_id=integration.id,
                status=ObjectStatus.ACTIVE,
            ).values_list("organization_id", flat=True)
        )
        org_regions = find_regions_for_orgs(organization_ids)
        for region_name in org_regions:
            region_groups = issue_service.get_external_issue_groups(
                region_name=region_name, external_issue_key=issue_key, integration_id=integration.id
            )
            if region_groups is not None:
                groups.extend(region_groups)
                has_groups = True

        if not has_groups:
            set_badge(integration, issue_key, 0)
            return self.get_response({"issue_not_linked": True})

        response = self.handle_groups(groups)
        scope.set_tag("status_code", response.status_code)

        set_badge(integration, issue_key, len(groups))
        return response
