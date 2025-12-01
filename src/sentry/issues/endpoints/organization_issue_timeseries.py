import collections
from collections.abc import Iterator
from datetime import datetime, timedelta
from heapq import nlargest
from typing import Any

from django.db.models import Count, DateTimeField, F, Func, Q
from django.db.models.functions import Extract
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.endpoints.timeseries import GroupBy, Row, SeriesMeta, TimeSeries
from sentry.api.helpers.environments import get_environments
from sentry.api.utils import get_date_range_from_params
from sentry.issues.grouptype import FeedbackGroup
from sentry.models.group import Group, GroupStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.snuba.discover import create_groupby_dict, create_result_key
from sentry.utils.dates import get_rollup_from_request

GROUPBY_TRANSLATION = {
    "release": "first_release__version",
}
INVERSE_GROUPBY_TRANSLATION = {value: key for key, value in GROUPBY_TRANSLATION.items()}


@region_silo_endpoint
class OrganizationIssueTimeSeriesEndpoint(OrganizationEndpoint):
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

        raw_groupby = request.GET.getlist("groupBy")
        if len(raw_groupby) > 0 and raw_groupby != ["release"]:
            raise ParseError("The only supported groupBy is currently release.")
        groupby = [GROUPBY_TRANSLATION[field] for field in raw_groupby]

        type_filter = (
            ~Q(type=FeedbackGroup.type_id)
            if issue_category == "issue"
            else Q(type=FeedbackGroup.type_id)
        )

        # This step validates our maximum granularity. Without this we could see unbounded
        # cardinality in our queries. Our maximum granularity is 200 which is more than enough to
        # accommodate common aggregation intervals.
        #
        # Max granularity estimates for a given range (rounded to understandable intervals):
        #   - One week range -> one hour interval.
        #   - One day range -> ten minute interval.
        #   - One hour range -> twenty second interval.
        interval = timedelta(
            seconds=get_rollup_from_request(
                request, end - start, "1h", ParseError("Invalid Interval"), max_rollup_override=200
            )
        )

        SUPPORTED_AXES: dict[str, dict[str, Any]] = {
            "count(new_issues)": {
                "objects": Group.objects,
                "date_column": "first_seen",
            },
            "count(resolved_issues)": {
                "objects": Group.objects.filter(status=GroupStatus.RESOLVED),
                "date_column": "resolved_at",
            },
        }

        axes = request.GET.getlist("yAxis", ["count(new_issues)"])
        for axis in axes:
            if axis not in SUPPORTED_AXES:
                raise ParseError(f"Unknown axis: {axis}")

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
            groupby_key_to_dict: dict[str, list[GroupBy]] = {}
            grouped_series: dict[str, list[Row]] = collections.defaultdict(list)
            for row in qs:
                key = create_result_key(row, group_by, {})
                groupby_dict = create_groupby_dict(row, group_by, {})
                for groupby_item in groupby_dict:
                    groupby_item["key"] = INVERSE_GROUPBY_TRANSLATION[groupby_item["key"]]
                groupby_key_to_dict[key] = groupby_dict
                grouped_counter[key] += row["value"]
                grouped_series[key].append(
                    Row(timestamp=row["timestamp"] * 1000, value=row["value"], incomplete=False)
                )

            # Group the smallest series into the "other" bucket.
            if len(grouped_series) > 4:
                keys = [
                    v[0] for v in nlargest(5, grouped_counter.items(), key=lambda i: (i[1], i[0]))
                ]

                new_grouped_series: dict[str, list[Row]] = {}
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
                            lambda i: Row(timestamp=i[0], value=i[1], incomplete=False),
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
                        is_other=None,
                        order=None,
                        values=[],
                    )
                ]

            return [
                make_timeseries_result(
                    axis=axis,
                    group=groupby_key_to_dict.get(key, []),
                    start=start,
                    end=end,
                    interval=interval,
                    is_other=key == "other" if len(new_grouped_series) > 1 else None,
                    order=i if len(new_grouped_series) > 1 else None,
                    values=series,
                )
                for i, (key, series) in enumerate(new_grouped_series.items())
            ]

        timeseries = []
        for axis in axes:
            axis_definition = SUPPORTED_AXES[axis]
            timeseries.extend(
                gen_ts(
                    axis_definition["objects"],
                    axis=axis,
                    date_column_name=(
                        axis_definition["date_column"] if len(groupby) == 0 else "first_seen"
                    ),
                    group_by=groupby,
                )
            )

        return Response(
            {
                "timeSeries": timeseries,
                "meta": {
                    "dataset": issue_category,
                    "end": end.timestamp() * 1000,
                    "start": start.timestamp() * 1000,
                },
            },
            status=200,
        )


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
        if group == "first_release__version":
            qs = qs.filter(first_release__isnull=False)

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
    group: list[GroupBy],
    start: datetime,
    end: datetime,
    interval: timedelta,
    is_other: bool | None,
    order: int | None,
    values: list[Row],
) -> TimeSeries:
    meta = SeriesMeta(
        interval=interval.seconds * 1000,
        valueType="integer",
        valueUnit=None,
    )
    if is_other is not None:
        meta["isOther"] = is_other
    if order is not None:
        meta["order"] = order
    return TimeSeries(
        yAxis=axis,
        groupBy=group,
        values=fill_timeseries(start, end, interval, values),
        meta=meta,
    )


class UnconsumedBuckets(LookupError):
    pass


def fill_timeseries(
    start: datetime,
    end: datetime,
    interval: timedelta,
    values: list[Row],
) -> list[Row]:
    # remove microseconds
    start = start.replace(microsecond=0)
    end = end.replace(microsecond=0)

    def iter_interval(start: datetime, end: datetime, interval: timedelta) -> Iterator[int]:
        while start <= end:
            yield int(start.timestamp() * 1000)
            start = start + interval

    filled_values: list[Row] = []
    index = 0
    for ts in iter_interval(start, end, interval):
        if index < len(values) and ts == values[index]["timestamp"]:
            filled_values.append(values[index])
            index += 1
        else:
            filled_values.append(Row(timestamp=ts, value=0, incomplete=False))

    if index != len(values):
        raise UnconsumedBuckets("Could not fill every bucket.")

    return filled_values
