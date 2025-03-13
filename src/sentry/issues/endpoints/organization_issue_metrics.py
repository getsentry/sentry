import collections
from collections.abc import Iterator
from datetime import datetime, timedelta
from itertools import chain
from typing import Any, TypedDict

from django.db.models import Count, DateTimeField, F, Func, Q
from django.db.models.functions import Extract
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

        interval_s = int(request.GET.get("interval", 3_600_000)) // 1000  # TODO: Safe parse
        interval = timedelta(seconds=interval_s)
        start, end = get_date_range_from_params(request.GET)

        def gen_ts(qs: QuerySet[Group], group_by: list[str], source: str, axis: str):
            qs = make_timeseries_query(
                qs,
                projects,
                environments,
                type_filter,
                group_by,
                interval,
                source,
                start,
                end,
            )

            grouped_series = collections.defaultdict(list)
            for row in qs:
                grouping = [row[g] for g in group_by]
                key = "||||".join(grouping)
                grouped_series[key].append({"timestamp": row["timestamp"], "value": row["value"]})

            return [
                make_timeseries_result(
                    axis=axis,
                    group=key.split("||||") if key else [],
                    interval=interval.seconds * 1000,
                    order=i,
                    values=series,
                )
                for i, (key, series) in enumerate(grouped_series.items())
            ]

        return Response(
            {
                "timeseries": chain(
                    gen_ts(query_new_issues(), [], "first_seen", "new_issues_count"),
                    gen_ts(query_resolved_issues(), [], "resolved_at", "resolved_issues_count"),
                    gen_ts(
                        query_issues_by_release(),
                        ["first_release__version"],
                        "first_seen",
                        "new_issues_count_by_release",
                    ),
                ),
                "meta": {
                    "dataset": "issues",
                    "end": end.timestamp(),
                    "start": start.timestamp(),
                },
            },
            status=200,
        )


class TimeSeries(TypedDict):
    timestamp: float
    value: float


class TimeSeriesResultMeta(TypedDict):
    groupby: list[str]
    interval: float
    isOther: bool
    order: int
    type: str
    unit: str | None


class TimeSeriesResult(TypedDict):
    axis: str
    meta: TimeSeriesResultMeta
    values: list[TimeSeries]


def make_timeseries_query(
    qs: QuerySet[Group],
    projects: list[Project],
    environments: list[int],
    type_filter: Q,
    group_by: list[str],
    stride: timedelta,
    source: str,
    start: datetime,
    end: datetime,
) -> QuerySet[Group, dict[str, Any]]:
    environment_filter = (
        Q(groupenvironment__environment_id=environments[0]) if environments else Q()
    )
    range_filters = {f"{source}__gte": start, f"{source}__lte": end}

    annotations = {}
    order_by = []
    values = []
    for group in group_by:
        annotations[group] = F(group)
        order_by.append(group)
        values.append(group)

    order_by.append("timestamp")
    values.append("timestamp")

    annotations["timestamp"] = Extract(
        Func(
            stride,
            source,
            start,
            function="date_bin",
            output_field=DateTimeField(),
        ),
        "epoch",
    )

    return (
        qs.filter(
            environment_filter,
            type_filter,
            project_id__in=[p.id for p in projects],
            **range_filters,
        )
        .annotate(**annotations)
        .order_by(*order_by)
        .values(*values)
        .annotate(value=Count("id"))
    )


def make_timeseries_result(
    axis: str,
    group: list[str],
    interval: int,
    order: int,
    values: list[TimeSeries],
) -> TimeSeriesResult:
    return {
        "axis": axis,
        "meta": {
            "groupBy": group,
            "interval": interval,
            "isOther": False,
            "order": order,
            "type": "integer",
            "unit": None,
        },
        "values": values,
    }


# Series generation.


class Series(TypedDict):
    bucket: datetime
    count: int


class SeriesResponseItem(TypedDict):
    count: int


SeriesResponse = dict[str, list[SeriesResponseItem]]


def query_new_issues() -> QuerySet[Group]:
    # SELECT count(*), day(first_seen) FROM issues GROUP BY day(first_seen)
    return Group.objects


def query_resolved_issues() -> QuerySet[Group]:
    # SELECT count(*), day(resolved_at) FROM issues WHERE status = resolved GROUP BY day(resolved_at)
    return Group.objects.filter(status=GroupStatus.RESOLVED)


def query_issues_by_release() -> QuerySet[Group]:
    # SELECT count(*), first_release.version FROM issues JOIN release GROUP BY first_release.version
    return Group.objects.filter(first_release__isnull=False)


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
