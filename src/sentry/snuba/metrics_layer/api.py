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


def _get_granularity(interval: int) -> int:
    best_granularity: Optional[int] = None

    for granularity in sorted(GRANULARITIES):
        if granularity <= interval:
            best_granularity = granularity

    if best_granularity is None:
        raise InvalidMetricsQuery("The interval specified is lower than the minimum granularity")

    return best_granularity


def _build_intervals(start: datetime, end: datetime, interval: int) -> Sequence[str]:
    """
    Builds a list of all the intervals that are queried by the metrics layer.
    """
    start_seconds = start.timestamp()
    end_seconds = end.timestamp()

    current_time = start_seconds
    intervals = [datetime.fromtimestamp(current_time).isoformat()]
    while current_time + interval <= end_seconds:
        next_time = current_time + interval
        intervals.append(datetime.fromtimestamp(next_time).isoformat())
        current_time = next_time

    return intervals


def _zerofill_series(
    start_seconds: int, num_intervals: int, interval: int, series: Sequence[Tuple[str, Any]]
) -> Sequence[Optional[Union[int, float]]]:
    """
    Computes a zerofilled series in which given a number of intervals, the start and the interval length,
    a list of zeros and the merged series values will be returned.
    """
    zerofilled_series = [None] * num_intervals
    for time, value in series:
        time_seconds = parse_datetime_string(time).timestamp()
        zerofill_index = int((time_seconds - start_seconds) / interval)
        zerofilled_series[zerofill_index] = value

    return zerofilled_series


def _translate_query_results(
    interval: int, query_results: Sequence[Tuple[str, Sequence[GroupBy], int, Mapping[str, Any]]]
) -> Mapping[str, Any]:
    """
    Converts the default format from the metrics layer format into the old format which is understood by the frontend.
    """
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
            for group_by in group_bys or ():
                grouped_values.append((group_by.key, value.get(group_by.key)))

            # The group key must be ordered, in order to be consistent across executions.
            group_key = tuple(sorted(grouped_values))
            serieses = groups.setdefault(group_key, {})
            series = serieses.setdefault(metric_name, [])
            series.append((value.get("time"), value.get("aggregate_value")))

    final_groups = []
    for group_key, group_serieses in groups.items():
        inner_group = {
            "by": {name: value for name, value in group_key},
            "series": {
                series_metric_name: _zerofill_series(
                    start.timestamp(), len(intervals), interval, series
                )
                for series_metric_name, series in group_serieses.items()
            },
            "totals": {
                # Totals will have to be supported by the metrics layer.
            },
        }

        final_groups.append(inner_group)

    return {
        "intervals": intervals,
        "groups": final_groups if len(final_groups) > 0 else None,
        "start": start.isoformat() if start is not None else None,
        "end": end.isoformat() if end is not None else None,
    }


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
        rollup=Rollup(interval=interval, granularity=_get_granularity(interval)),
        scope=MetricsScope(
            org_ids=[organization.id],
            project_ids=[project.id for project in projects],
            use_case_id=use_case_id.value,
        ),
    )

    # Parse all the strings and convert them to an intermediate format.
    fields = _parse_fields(fields)
    filters = _parse_query(query)
    group_bys = _parse_group_by(group_bys)

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
