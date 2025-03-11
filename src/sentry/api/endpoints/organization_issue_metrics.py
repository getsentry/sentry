from collections.abc import Iterator
from datetime import datetime, timedelta
from typing import Any, TypedDict

from django.db.models import Count, F, Q
from django.db.models.functions import TruncDay
from django.db.models.query import QuerySet
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.helpers.environments import get_environments
from sentry.api.utils import get_date_range_from_params
from sentry.issues.grouptype import GroupCategory
from sentry.models.group import Group, GroupStatus
from sentry.models.organization import Organization
from sentry.models.project import Project

CATEGORY_MAP = {
    "error": GroupCategory.ERROR,
    "feedback": GroupCategory.FEEDBACK,
}


@region_silo_endpoint
class OrganizationIssueMetricsEndpoint(OrganizationEndpoint, EnvironmentMixin):
    owner = ApiOwner.REPLAY
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(self, request: Request, organization: Organization) -> Response:
        """Stats bucketed by time."""
        environments = [e.id for e in get_environments(request, organization)]
        projects = self.get_projects(request, organization)
        issue_category = request.GET.get("category", "error")
        type_filter = (
            ~Q(type=GroupCategory.FEEDBACK)
            if issue_category == "error"
            else Q(type=GroupCategory.FEEDBACK)
        )
        group_by = request.GET.get("group_by", "time")

        # Start/end truncation and interval generation.
        interval = timedelta(days=1)  # interval = request.GET.get("interval", "1d")
        start, end = get_date_range_from_params(request.GET)
        end = end.replace(hour=0, minute=0, second=0, microsecond=0) + interval
        start = start.replace(hour=0, minute=0, second=0, microsecond=0)

        if group_by == "time":
            # Series queries.
            new_series = query_new_issues(projects, environments, type_filter, start, end)
            resolved_series = query_resolved_issues(projects, environments, type_filter, start, end)

            # Filling and formatting.
            series_response = empty_response(start, end, interval)
            append_series(series_response, new_series)
            append_series(series_response, resolved_series)
        elif group_by == "release":
            series_response = query_issues_by_release(
                projects, environments, type_filter, start, end
            )
        else:
            return Response("", status=404)

        return Response(
            {
                "data": [[bucket, series] for bucket, series in series_response.items()],
                "start": int(start.timestamp()),
                "end": int(end.timestamp()),
                # I have no idea what purpose this data serves on the front-end.
                "isMetricsData": False,
                "meta": {
                    "fields": {"time": "date", "issues_count": "count"},
                    "units": {"time": None, "issues_count": "int"},
                    "isMetricsData": False,
                    "isMetricsExtractedData": False,
                    "tips": {},
                    "datasetReason": "unchanged",
                    "dataset": "groups",
                },
            },
            status=200,
        )


# Series generation.


class Series(TypedDict):
    bucket: datetime
    count: int


class SeriesResponseItem(TypedDict):
    count: int


SeriesResponse = dict[str, list[SeriesResponseItem]]


def query_new_issues(
    projects: list[Project],
    environments: list[int],
    type_filter: Q,
    start: datetime,
    end: datetime,
) -> list[dict[str, Any]]:
    # SELECT count(*), day(first_seen) FROM issues GROUP BY day(first_seen)
    group_environment_filter = (
        Q(groupenvironment__environment_id=environments[0]) if environments else Q()
    )

    issues_query = (
        Group.objects.filter(
            group_environment_filter,
            type_filter,
            first_seen__gte=start,
            first_seen__lte=end,
            project__in=projects,
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
    type_filter: Q,
    start: datetime,
    end: datetime,
) -> list[dict[str, Any]]:
    # SELECT count(*), day(resolved_at) FROM issues WHERE status = resolved GROUP BY day(resolved_at)
    group_environment_filter = (
        Q(groupenvironment__environment_id=environments[0]) if environments else Q()
    )
    resolved_issues_query = (
        Group.objects.filter(
            group_environment_filter,
            type_filter,
            resolved_at__gte=start,
            resolved_at__lte=end,
            project__in=projects,
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
    type_filter: Q,
    start: datetime,
    end: datetime,
) -> SeriesResponse:
    # SELECT count(*), first_release.version FROM issues JOIN release GROUP BY first_release.version
    group_environment_filter = (
        Q(groupenvironment__environment_id=environments[0]) if environments else Q()
    )
    issues_by_release_query = (
        Group.objects.filter(
            group_environment_filter,
            type_filter,
            first_seen__gte=start,
            first_seen__lte=end,
            project__in=projects,
            first_release__isnull=False,
        )
        .annotate(bucket=F("first_release__version"))
        .order_by("bucket")
        .values("bucket")
        .annotate(count=Count("id"))
    )
    return to_series(issues_by_release_query)


# Response filling and formatting.


class BucketNotFound(LookupError):
    pass


def append_series(resp: SeriesResponse, series: list[dict[str, Any]]) -> None:
    # We're going to increment this index as we consume the series.
    idx = 0

    for bucket in resp.keys():
        try:
            next_bucket = str(int(series[idx]["bucket"].timestamp()))
        except IndexError:
            next_bucket = "-1"

        # If the buckets match use the series count.
        if next_bucket == bucket:
            resp[bucket].append({"count": series[idx]["count"]})
            idx += 1
        # If the buckets do not match generate a value to fill its slot.
        else:
            resp[bucket].append({"count": 0})

    # Programmer error. Requires code fix. Likely your query is not truncating timestamps the way
    # you think it is.
    if idx != len(series):
        raise BucketNotFound("No buckets matched. Did your query truncate correctly?")


def empty_response(start: datetime, end: datetime, interval: timedelta) -> SeriesResponse:
    return {bucket: [] for bucket in iter_interval(start, end, interval)}


def iter_interval(start: datetime, end: datetime, interval: timedelta) -> Iterator[str]:
    while start <= end:
        yield str(int(start.timestamp()))
        start = start + interval


def to_series(series: QuerySet[Any, dict[str, Any]]) -> SeriesResponse:
    return {s["bucket"]: [{"count": s["count"]}] for s in series}
