from datetime import datetime, timedelta
from typing import TypedDict

from django.db.models import Count, F, Q
from django.db.models.functions import TruncDay
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.helpers.environments import get_environments
from sentry.api.utils import get_date_range_from_params
from sentry.models.group import Group, GroupCategory, GroupStatus
from sentry.models.organization import Organization
from sentry.models.project import Project

CATEGORY_MAP = {
    "error": GroupCategory.ERROR,
    "feedback": GroupCategory.FEEDBACK,
}


@region_silo_endpoint
class OrganizationIssueBreakdownEndpoint(OrganizationEndpoint, EnvironmentMixin):
    owner = ApiOwner.REPLAY
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(self, request: Request, organization: Organization) -> Response:
        """Stats bucketed by time."""
        start, end = get_date_range_from_params(request.GET)
        end = end.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        start = start.replace(hour=0, minute=0, second=0, microsecond=0)
        environments = [e.id for e in get_environments(request, organization)]
        projects = self.get_projects(request, organization)
        issue_category = CATEGORY_MAP.get(request.GET.get("category", "error"), GroupCategory.ERROR)
        group_by = request.GET.get("group_by", "new")

        if group_by == "new":
            response = query_new_issues(projects, environments, issue_category, start, end)
            return Response({"data": response}, status=200)
        if group_by == "resolved":
            response = query_resolved_issues(projects, environments, issue_category, start, end)
            return Response({"data": response}, status=200)
        if group_by == "release":
            response = query_issues_by_release(projects, environments, issue_category, start, end)
            return Response({"data": response}, status=200)
        else:
            return Response("", status=404)


class BreakdownQueryResult(TypedDict):
    bucket: str
    count: int


def query_new_issues(
    projects: list[Project],
    environments: list[int],
    issue_category: int,
    start: datetime,
    end: datetime,
) -> list[BreakdownQueryResult]:
    # SELECT count(*), day(first_seen) FROM issues GROUP BY day(first_seen)
    group_environment_filter = (
        Q(groupenvironment__environment_id=environments[0]) if environments else Q()
    )
    issues_query = (
        Group.objects.filter(
            group_environment_filter,
            first_seen__gte=start,
            first_seen__lte=end,
            project__in=projects,
            type=issue_category,
        )
        .annotate(bucket=TruncDay("first_seen"))
        .order_by("bucket")
        .values("bucket")
        .annotate(count=Count("id"))
    )
    return list(issues_query)


def query_resolved_issues(
    projects: list[Project],
    environments: list[int],
    issue_category: int,
    start: datetime,
    end: datetime,
) -> list[BreakdownQueryResult]:
    # SELECT count(*), day(resolved_at) FROM issues WHERE status = resolved GROUP BY day(resolved_at)
    group_environment_filter = (
        Q(groupenvironment__environment_id=environments[0]) if environments else Q()
    )
    resolved_issues_query = (
        Group.objects.filter(
            group_environment_filter,
            first_seen__gte=start,
            first_seen__lte=end,
            project__in=projects,
            type=issue_category,
            status=GroupStatus.RESOLVED,
        )
        .annotate(bucket=TruncDay("resolved_at"))
        .order_by("bucket")
        .values("bucket")
        .annotate(count=Count("id"))
    )
    return list(resolved_issues_query)


def query_issues_by_release(
    projects: list[Project],
    environments: list[int],
    issue_category: int,
    start: datetime,
    end: datetime,
) -> list[BreakdownQueryResult]:
    # SELECT count(*), first_release.version FROM issues JOIN release GROUP BY first_release.version
    group_environment_filter = (
        Q(groupenvironment__environment_id=environments[0]) if environments else Q()
    )
    issues_by_release_query = (
        Group.objects.filter(
            group_environment_filter,
            first_seen__gte=start,
            first_seen__lte=end,
            project__in=projects,
            type=issue_category,
        )
        .annotate(bucket=F("first_release__version"))
        .order_by("bucket")
        .values("bucket")
        .annotate(count=Count("id"))
    )
    return list(issues_by_release_query)
