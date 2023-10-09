import re
from dataclasses import dataclass
from datetime import datetime, timezone
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
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.naming_layer.mapping import is_mri
from sentry.snuba.metrics_layer.query import run_query

GRANULARITIES = [
    10,  # 10 seconds
    60,  # 1 minute
    60 * 60,  # 1 hour
    60 * 60 * 24,  # 24 hours
]

# These regexes are temporary since the DSL is supposed to be parsed internally by the snuba SDK, thus this
# is only bridging code to validate and evolve the metrics layer.
FIELD_REGEX = re.compile(r"^(\w+)\(([^\s]+)\)$")
QUERY_REGEX = re.compile(r"(\w+):([^\s]+)(?:\s*)")


class InvalidMetricsQuery(Exception):
    pass


@dataclass(frozen=True)
class Field:
    aggregate: str
    metric_name: str

    def refers_to_mri(self) -> bool:
        return is_mri(self.metric_name)


@dataclass(frozen=True)
class Filter:
    key: str
    value: Union[str, int, float]


@dataclass(frozen=True)
class GroupBy:
    key: str


def _parse_fields(fields: Sequence[str]) -> Sequence[Field]:
    """
    This function supports parsing in the form:
    aggregate(metric_name)
    """
    if not fields:
        raise InvalidMetricsQuery("You must query at least one field.")

    # We use a set, since we don't want duplicate fields.
    parsed_fields = set()
    for field in fields:
        match = FIELD_REGEX.match(field)
        if match is None:
            raise InvalidMetricsQuery(f"The field {field} can't be parsed.")

        parsed_fields.add(Field(aggregate=match.group(1), metric_name=match.group(2)))

    return list(parsed_fields)


def _parse_query(query: Optional[str]) -> Optional[Sequence[Filter]]:
    """
    This function supports parsing in the form:
    key:value (_ key:value)?
    in which the only supported operator is AND until this logic is switched to the metrics layer.
    """
    if query is None:
        return None

    filters = []
    matches = QUERY_REGEX.findall(query)
    for key, value in matches:
        filters.append(Filter(key=key, value=value))

    if not query:
        raise InvalidMetricsQuery("Error while parsing the query.")

    return filters


def _parse_group_by(group_bys: Optional[Sequence[str]]) -> Optional[Sequence[GroupBy]]:
    """
    This function supports parsing in the form:
    value (_ value)?
    """
    if group_bys is None:
        return None

    # For uniformity, we also convert the group bys to internal dataclasses.
    return [GroupBy(key=group_by) for group_by in group_bys]


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


def _filters_to_snql(filters: Optional[Sequence[Filter]]) -> Optional[ConditionGroup]:
    if filters is None:
        return None

    conditions = []
    for _filter in filters:
        condition = Condition(lhs=Column(name=_filter.key), op=Op.EQ, rhs=_filter.value)
        conditions.append(condition)

    return conditions


def _group_bys_to_snql(
    group_bys: Optional[Sequence[GroupBy]],
) -> Optional[List[Union[Column, AliasedExpression]]]:
    if group_bys is None:
        return None

    columns = []
    for group_by in group_bys:
        columns.append(Column(name=group_by.key))

    return columns


def _get_granularity(time_seconds: int) -> int:
    """
    Determines the optimal granularity to resolve a query over an interval of time_seconds.
    """
    best_granularity: Optional[int] = None

    for granularity in sorted(GRANULARITIES):
        if granularity <= time_seconds:
            best_granularity = granularity

    if best_granularity is None:
        raise InvalidMetricsQuery("The time specified is lower than the minimum granularity")

    return best_granularity


def _build_intervals(start: datetime, end: datetime, interval: int) -> Sequence[datetime]:
    """
    Builds a list of all the intervals that are queried by the metrics layer.
    """
    start_seconds = start.timestamp()
    end_seconds = end.timestamp()

    current_time = start_seconds
    intervals = []
    while current_time < end_seconds:
        intervals.append(datetime.fromtimestamp(current_time, timezone.utc))
        current_time = current_time + interval

    return intervals


def _generate_full_series(
    start_seconds: int, num_intervals: int, interval: int, series: Sequence[Tuple[str, Any]]
) -> Union[int, float, Sequence[Optional[Union[int, float]]]]:
    """
    Computes a full series over the entire requested interval with None set where there are no data points.
    """
    full_series = [None] * num_intervals
    for time, value in series:
        time_seconds = parse_datetime_string(time).timestamp()
        index = int((time_seconds - start_seconds) / interval)
        full_series[index] = value

    return full_series


def _translate_query_results(
    interval: int,
    query_results: Sequence[Tuple[str, Optional[Sequence[GroupBy]], int, Mapping[str, Any]]],
) -> Mapping[str, Any]:
    """
    Converts the default format from the metrics layer format into the old format which is understood by the frontend.
    """
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    intervals: Optional[Sequence[datetime]] = None

    # For efficiency reasons, we translate the incoming data into our custom in-memory representations.
    intermediate_groups: Dict[
        Tuple[Tuple[str, str], ...], Dict[str, List[Union[Any, List[Tuple[str, Any]]]]]
    ] = {}
    intermediate_meta: Dict[str, str] = {}
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
        for data_item in data:
            grouped_values = []
            for group_by in group_bys or ():
                grouped_values.append((group_by.key, data_item.get(group_by.key)))

            # The group key must be ordered, in order to be consistent across executions.
            group_key = tuple(sorted(grouped_values))
            group_metrics = intermediate_groups.setdefault(group_key, {})
            metric_values = group_metrics.setdefault(metric_name, [[], 0])
            # The item at position 0 is the "series".
            metric_values[0].append((data_item.get("time"), data_item.get("aggregate_value")))

        # TODO: reduce duplication.
        totals = snuba_result["totals"]
        for totals_item in totals:
            grouped_values = []
            for group_by in group_bys or ():
                grouped_values.append((group_by.key, totals_item.get(group_by.key)))

            # The group key must be ordered, in order to be consistent across executions.
            group_key = tuple(sorted(grouped_values))
            group_metrics = intermediate_groups.setdefault(group_key, {})
            metric_values = group_metrics.setdefault(metric_name, [[], 0])
            # The item at position 1 is the "totals".
            metric_values[1] = totals_item.get("aggregate_value")

        meta = snuba_result["meta"]
        for meta_item in meta:
            meta_name = meta_item.get("name")
            meta_type = meta_item.get("type")

            # Since we have to handle multiple time series, we map the aggregate value to the actual
            # metric name that was queried.
            if meta_name == "aggregate_value":
                intermediate_meta[metric_name] = meta_type
            else:
                intermediate_meta[meta_name] = meta_type

    translated_groups = []
    for group_key, group_metrics in sorted(intermediate_groups.items(), key=lambda v: v[0]):
        # This case should never happen, since if we have start and intervals not None
        assert start is not None and end is not None and intervals is not None

        start_seconds = int(start.timestamp())
        num_intervals = len(intervals)

        series = {}
        totals = {}
        for metric_name, metric_values in sorted(group_metrics.items(), key=lambda v: v[0]):
            series[metric_name] = _generate_full_series(
                start_seconds, num_intervals, interval, metric_values[0]
            )
            totals[metric_name] = metric_values[1]

        inner_group = {
            "by": {name: value for name, value in group_key},
            "series": series,
            "totals": totals,
        }

        translated_groups.append(inner_group)

    translated_meta = [
        {"name": meta_name, "type": meta_type} for meta_name, meta_type in intermediate_meta.items()
    ]

    return {
        "intervals": intervals,
        "groups": translated_groups,
        "meta": translated_meta,
        "start": start,
        "end": end,
    }


def _execute_series_and_totals_query(
    organization: Organization, use_case_id: UseCaseID, interval: int, base_query: MetricsQuery
) -> Mapping[str, Any]:
    dataset = Dataset.Metrics if use_case_id == UseCaseID.SESSIONS else Dataset.PerformanceMetrics
    request = Request(
        dataset=dataset.value,
        query=base_query,
        app_id="default",
        tenant_ids={"referrer": "metrics.data", "organization_id": organization.id},
    )

    base_query.rollup = Rollup(interval=interval, granularity=_get_granularity(interval))
    series_result = run_query(request=request)

    # This is a hack, to make sure that we choose the right granularity for the totals query.
    # This is done since for example if we query 24 hours with 1 hour interval:
    # * For series the granularity is 1 hour since we want to aggregate on 1 hour
    # * For totals it doesn't make sense to choose 1 hour, and instead it's better to choose 24 hours
    series_start_seconds = series_result["start"].timestamp()
    series_end_seconds = series_result["end"].timestamp()
    totals_interval_seconds = int(series_end_seconds - series_start_seconds)

    base_query.rollup = Rollup(totals=True, granularity=_get_granularity(totals_interval_seconds))
    request.query = base_query
    totals_result = run_query(request=request)

    return {**series_result, "totals": totals_result["data"]}


def run_metrics_query(
    fields: Sequence[str],
    query: Optional[str],
    group_bys: Optional[Sequence[str]],
    interval: int,
    start: datetime,
    end: datetime,
    use_case_id: UseCaseID,
    organization: Organization,
    projects: Sequence[Project],
):
    # Build the basic query that contains the metadata.
    base_query = MetricsQuery(
        start=start,
        end=end,
        scope=MetricsScope(
            org_ids=[organization.id],
            project_ids=[project.id for project in projects],
            use_case_id=use_case_id.value,
        ),
    )

    # Parse all the strings and convert them to an intermediate format.
    parsed_fields = _parse_fields(fields)
    parsed_filters = _parse_query(query)
    parsed_group_bys = _parse_group_by(group_bys)

    # Build the filters and group bys ready to be injected into each query generated by a field.
    snql_filters = _filters_to_snql(parsed_filters)
    snql_group_bys = _group_bys_to_snql(parsed_group_bys)

    # For each field generate the query.
    query_results = []
    for field in parsed_fields:
        base_query.query = _build_snql_query(field, snql_filters, snql_group_bys)
        snuba_result = _execute_series_and_totals_query(
            organization, use_case_id, interval, base_query
        )
        query_results.append(
            (
                f"{field.aggregate}({field.metric_name})",
                parsed_group_bys,
                interval,
                snuba_result,
            )
        )

    translated_results = _translate_query_results(
        interval=base_query.rollup.interval, query_results=query_results
    )

    return translated_results
