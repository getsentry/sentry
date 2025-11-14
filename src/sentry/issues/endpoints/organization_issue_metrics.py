import collections
from collections.abc import Iterator
from datetime import datetime, timedelta
from heapq import nlargest
from itertools import chain
from typing import int, TypedDict

from django.db.models import Count, DateTimeField, F, Func, Q
from django.db.models.functions import Extract
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.helpers.environments import get_environments
from sentry.api.utils import get_date_range_from_params
from sentry.issues.grouptype import FeedbackGroup
from sentry.models.group import Group, GroupStatus
from sentry.models.organization import Organization
from sentry.models.project import Project


@region_silo_endpoint
class OrganizationIssueMetricsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(self, request: Request, organization: Organization) -> Response:
        """Stats bucketed by time."""
        environments = [e.id for e in get_environments(request, organization)]
        projects = self.get_projects(request, organization)
        start, end = get_date_range_from_params(request.GET)
        issue_category = request.GET.get("category", "issue")

        if issue_category not in ["issue", "feedback"]:
            raise ParseError("Invalid issue category. Valid options are 'issue' and 'feedback'.")

        type_filter = (
            ~Q(type=FeedbackGroup.type_id)
            if issue_category == "issue"
            else Q(type=FeedbackGroup.type_id)
        )

        try:
            interval_s = int(request.GET["interval"]) // 1000
            if interval_s == 0:
                raise ParseError("Interval must be greater than 1000 milliseconds.")
            interval = timedelta(seconds=interval_s)
        except KeyError:
            # Defaulting for now. Probably better to compute some known interval. I.e. if we're
            # close to an hour round up to an hour to ensure the best visual experience.
            #
            # Or maybe we require this field and ignore all these problems.
            interval_s = 3600
            interval = timedelta(seconds=interval_s)
        except ValueError:
            raise ParseError("Could not parse interval value.")

        # This step validates our maximum granularity. Without this we could see unbounded
        # cardinality in our queries. Our maximum granularity is 200 which is more than enough to
        # accommodate common aggregation intervals.
        #
        # Max granularity estimates for a given range (rounded to understandable intervals):
        #   - One week range -> one hour interval.
        #   - One day range -> ten minute interval.
        #   - One hour range -> twenty second interval.
        number_of_buckets = (end - start).total_seconds() // interval.total_seconds()
        if number_of_buckets > 200:
            raise ParseError("The specified granularity is too precise. Increase your interval.")

        def gen_ts(
            qs,
            group_by: list[str],
            date_column_name: str,
            axis: str,
        ):
            qs = make_timeseries_query(
                qs,
                projects,
                environments,
                type_filter,
                group_by,
                interval,
                date_column_name,
                start,
                end,
            )

            grouped_counter: collections.defaultdict[str, int] = collections.defaultdict(int)
            grouped_series: dict[str, list[TimeSeries]] = collections.defaultdict(list)
            for row in qs:
                grouping = [row[g] for g in group_by]
                key = "||||".join(grouping)
                grouped_counter[key] += row["value"]
                grouped_series[key].append({"timestamp": row["timestamp"], "value": row["value"]})

            # Group the smallest series into the "other" bucket.
            if len(grouped_series) > 4:
                keys = [v[0] for v in nlargest(5, grouped_counter.items(), key=lambda i: i[0])]

                new_grouped_series: dict[str, list[TimeSeries]] = {}
                other_series: collections.defaultdict[float, float] = collections.defaultdict(float)
                for key, series in grouped_series.items():
                    if key in keys:
                        new_grouped_series[key] = series
                    else:
                        for s in series:
                            other_series[s["timestamp"]] += s["value"]

                if other_series:
                    new_grouped_series["other"] = list(
                        map(
                            lambda i: {"timestamp": i[0], "value": i[1]},
                            sorted(list(other_series.items()), key=lambda i: i[0]),
                        )
                    )
            else:
                new_grouped_series = grouped_series

            # Return a default empty state if nothing found.
            if len(new_grouped_series) == 0:
                return [
                    make_timeseries_result(
                        axis=axis,
                        group=[],
                        start=start,
                        end=end,
                        interval=interval,
                        is_other=False,
                        order=0,
                        values=[],
                    )
                ]

            return [
                make_timeseries_result(
                    axis=axis,
                    group=key.split("||||") if key else [],
                    start=start,
                    end=end,
                    interval=interval,
                    is_other=key == "other",
                    order=i,
                    values=series,
                )
                for i, (key, series) in enumerate(new_grouped_series.items())
            ]

        return Response(
            {
                "timeseries": chain(
                    gen_ts(
                        Group.objects,
                        axis="new_issues_count",
                        date_column_name="first_seen",
                        group_by=[],
                    ),
                    gen_ts(
                        Group.objects.filter(status=GroupStatus.RESOLVED),
                        axis="resolved_issues_count",
                        date_column_name="resolved_at",
                        group_by=[],
                    ),
                    gen_ts(
                        Group.objects.filter(first_release__isnull=False),
                        axis="new_issues_count_by_release",
                        date_column_name="first_seen",
                        group_by=["first_release__version"],
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
    interval: float
    isOther: bool
    order: int
    valueType: str
    valueUnit: str | None


class TimeSeriesResult(TypedDict):
    axis: str
    groupBy: list[str]
    meta: TimeSeriesResultMeta
    values: list[TimeSeries]


def make_timeseries_query(
    qs,
    projects: list[Project],
    environments: list[int],
    type_filter: Q,
    group_by: list[str],
    stride: timedelta,
    source: str,
    start: datetime,
    end: datetime,
):
    environment_filter = (
        Q(groupenvironment__environment_id=environments[0]) if environments else Q()
    )
    range_filters = {f"{source}__gte": start, f"{source}__lte": end}

    annotations: dict[str, F | Extract] = {}
    order_by = []
    values = []
    for group in group_by:
        annotations[group] = F(group)
        order_by.append(group)
        values.append(group)

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
    order_by.append("timestamp")
    values.append("timestamp")

    qs = (
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
    return qs


def make_timeseries_result(
    axis: str,
    group: list[str],
    start: datetime,
    end: datetime,
    interval: timedelta,
    is_other: bool,
    order: int,
    values: list[TimeSeries],
) -> TimeSeriesResult:
    return {
        "axis": axis,
        "groupBy": group,
        "meta": {
            "interval": interval.total_seconds() * 1000,
            "isOther": is_other,
            "order": order,
            "valueType": "integer",
            "valueUnit": None,
        },
        "values": fill_timeseries(start, end, interval, values),
    }


class UnconsumedBuckets(LookupError):
    pass


def fill_timeseries(
    start: datetime,
    end: datetime,
    interval: timedelta,
    values: list[TimeSeries],
) -> list[TimeSeries]:
    def iter_interval(start: datetime, end: datetime, interval: timedelta) -> Iterator[int]:
        while start <= end:
            yield int(start.timestamp())
            start = start + interval

    filled_values: list[TimeSeries] = []
    idx = 0
    for ts in iter_interval(start, end, interval):
        if idx < len(values) and ts == values[idx]["timestamp"]:
            filled_values.append(values[idx])
            idx += 1
        else:
            filled_values.append({"timestamp": ts, "value": 0})

    if idx != len(values):
        raise UnconsumedBuckets("Could not fill every bucket.")

    return filled_values
