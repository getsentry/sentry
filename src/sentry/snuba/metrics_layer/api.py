import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple, Union

from snuba_sdk import (
    AliasedExpression,
    Column,
    Metric,
    MetricsQuery,
    MetricsScope,
    Request,
    Rollup,
    Timeseries,
)
from snuba_sdk.conditions import Condition, ConditionGroup, Op

from sentry.models import Organization, Project
from sentry.search.utils import parse_datetime_string
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.naming_layer.mapping import is_mri
from sentry.snuba.metrics_layer.query import run_query
from sentry.utils.dates import parse_stats_period

GRANULARITIES = [
    10,  # 10 seconds
    60,  # 1 minute
    60 * 60,  # 1 hour
    60 * 60 * 24,  # 24 hours
]

FIELD_REGEX = re.compile(r"(\w+)\(([^\s]+)\)(?:\s*)")
QUERY_REGEX = re.compile(r"(\w+):([^\s]+)(?:\s*)")
GROUP_BY_REGEX = re.compile(r"(\w+)(?:\s*)")


@dataclass
class Field:
    aggregate: str
    metric_name: str

    def refers_to_mri(self) -> bool:
        return is_mri(self.metric_name)


@dataclass
class Filter:
    key: str
    value: Union[str, int, float]


@dataclass
class GroupBy:
    key: str


def _parse_fields(field: str) -> Sequence[Field]:
    """
    This function supports parsing in the form:
    aggregate(metric_name) (_ aggregate(metric_name))?
    """
    fields = []

    matches = FIELD_REGEX.findall(field)
    for aggregate, metric_name in matches:
        fields.append(Field(aggregate=aggregate, metric_name=metric_name))

    return fields


def _parse_query(query: str) -> Sequence[Filter]:
    """
    This function supports parsing in the form:
    key:value (_ key:value)?
    in which the only supported operator is AND.
    """
    filters = []

    matches = QUERY_REGEX.findall(query)
    for key, value in matches:
        filters.append(Filter(key=key, value=value))

    return filters


def _parse_group_by(group_by: str) -> Sequence[GroupBy]:
    """
    This function supports parsing in the form:
    value (_ value)?
    """
    group_bys = []

    matches = GROUP_BY_REGEX.findall(group_by)
    for key in matches:
        group_bys.append(GroupBy(key=key))

    return group_bys


def _build_snql_query(
    field: Field,
    snql_filters: Optional[ConditionGroup],
    snql_group_bys: Optional[List[Union[Column, AliasedExpression]]],
) -> Timeseries:
    if field.refers_to_mri():
        metric = Metric(mri=field.metric_name)
    else:
        metric = Metric(public_name=field.metric_name)

    return Timeseries(
        metric=metric,
        aggregate=field.aggregate,
        filters=snql_filters,
        groupby=snql_group_bys,
    )


def _filters_to_snql(filters: Sequence[Filter]) -> Optional[ConditionGroup]:
    condition_group = []

    for _filter in filters:
        condition = Condition(lhs=Column(name=_filter.key), op=Op.EQ, rhs=_filter.value)
        condition_group.append(condition)

    return condition_group


def _group_bys_to_snql(
    group_bys: Sequence[GroupBy],
) -> Optional[List[Union[Column, AliasedExpression]]]:
    columns = []

    for group_by in group_bys:
        columns.append(Column(name=group_by.key))

    return columns


def _get_granularity(interval: int) -> int:
    best_granularity: Optional[int] = None

    for granularity in sorted(GRANULARITIES):
        if granularity <= interval:
            best_granularity = granularity

    if best_granularity is None:
        raise Exception("The interval specified is lower than the minimum granularity")

    return best_granularity


def _get_date_range(interval: str, start: str, end: str) -> Tuple[datetime, datetime, int, int]:
    interval = parse_stats_period(interval)
    interval = int(3600 if interval is None else interval.total_seconds())

    start = parse_datetime_string(start)
    end = parse_datetime_string(end)

    return start, end, interval, _get_granularity(interval)


def _build_intervals(start: datetime, end: datetime, interval: int) -> Sequence[str]:
    start_seconds = start.timestamp()
    end_seconds = end.timestamp()

    current_time = start_seconds
    intervals = [datetime.fromtimestamp(current_time).isoformat()]
    while current_time + interval <= end_seconds:
        next_time = current_time + interval
        intervals.append(datetime.fromtimestamp(next_time).isoformat())
        current_time = next_time

    return intervals


def _merge_intervals_with_values(
    start_seconds: int, num_intervals: int, interval: int, series: Sequence[Tuple[str, Any]]
) -> Sequence[Any]:
    zerofilled_series = [0.0] * num_intervals
    for time, value in series:
        time_seconds = parse_datetime_string(time).timestamp()
        zerofill_index = int((time_seconds - start_seconds) / interval)
        # TODO: check how to perform value conversion.
        zerofilled_series[zerofill_index] = value

    return zerofilled_series


def _translate_query_results(
    interval: int, query_results: Sequence[Tuple[str, Sequence[GroupBy], int, Mapping[str, Any]]]
) -> Mapping[str, Any]:
    """
    from

    {'aggregate_value': 4.0,
    'time': '2023-10-03T10:00:00+00:00',
    'transaction': '/hello'}

    to

    {
        "by": {"val": 1, "val": 2},
        "series": {
            "mri": []
        },
        "totals": {
            "mri": 1.0
        },
    }
    """
    if len(query_results) == 0:
        return {}

    intervals = None
    start = None
    end = None

    groups: Dict[Tuple[Tuple[str, str], ...], Dict[str, List[Tuple[str, Any]]]] = {}
    for metric_name, group_bys, interval, snuba_result in query_results:
        # Very ugly way to build the intervals start and end from the run queries, since they are all using
        # the same params. This would be solved once this code is embedded within the layer itself.
        if start is None:
            start = snuba_result["start"]
        if end is None:
            end = snuba_result["end"]
        if intervals is None:
            intervals = _build_intervals(start, end, interval)

        data = snuba_result["data"]
        for value in data:
            grouped_values = []
            for group_by in group_bys:
                grouped_values.append((group_by.key, value.get(group_by.key)))

            # The group key must be ordered, in order to be consistent across execution.
            group_key = tuple(sorted(grouped_values))
            serieses = groups.setdefault(group_key, {})
            series = serieses.setdefault(metric_name, [])
            series.append((value.get("time"), value.get("aggregate_value")))

    final_groups = []
    for group_key, group_serieses in groups.items():
        inner_group = {
            "by": {name: value for name, value in group_key},
            "series": {
                series_metric_name: _merge_intervals_with_values(
                    start.timestamp(), len(intervals), interval, series
                )
                for series_metric_name, series in group_serieses.items()
            },
            "totals": {},
        }

        final_groups.append(inner_group)

    return {
        "intervals": intervals,
        "groups": final_groups,
        "start": start.isoformat(),
        "end": end.isoformat(),
    }


def run_metrics_query(
    field: str,
    query: str,
    group_by: str,
    interval: str,
    start: str,
    end: str,
    use_case_id: UseCaseID,
    organization: Organization,
    projects: Sequence[Project],
):
    # Build the basic query that contains the metadata.
    start, end, interval, granularity = _get_date_range(interval, start, end)
    base_query = MetricsQuery(
        start=start,
        end=end,
        rollup=Rollup(interval=interval, granularity=granularity),
        scope=MetricsScope(
            org_ids=[organization.id],
            project_ids=[project.id for project in projects],
            use_case_id=use_case_id.value,
        ),
    )

    # Parse all the strings and convert them to an intermediate format.
    fields = _parse_fields(field)
    filters = _parse_query(query)
    group_bys = _parse_group_by(group_by)

    # Build the filters and group bys ready to be injected into each query generated by a field.
    snql_filters = _filters_to_snql(filters)
    snql_group_bys = _group_bys_to_snql(group_bys)

    # For each field generate the query.
    query_results = []
    for field in fields:
        base_query.query = _build_snql_query(field, snql_filters, snql_group_bys)
        request = Request(
            dataset="generic_metrics",
            app_id="default",
            query=base_query,
            tenant_ids={"referrer": "metrics.data", "organization_id": organization.id},
        )
        snuba_result = run_query(request=request)

        query_results.append(
            (
                f"{field.aggregate}({field.metric_name})",
                group_bys,
                base_query.rollup.interval,
                snuba_result,
            )
        )

    translated_results = _translate_query_results(
        interval=base_query.rollup.interval, query_results=query_results
    )

    return translated_results
