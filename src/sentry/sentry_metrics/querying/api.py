import math
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Generator, List, Mapping, Optional, Sequence, Tuple, Union

from snuba_sdk import (
    AliasedExpression,
    Column,
    MetricsQuery,
    MetricsScope,
    Request,
    Rollup,
    Timeseries,
)
from snuba_sdk.conditions import Condition, ConditionGroup, Op
from snuba_sdk.dsl.dsl import parse_mql

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.utils import parse_datetime_string
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics_layer.query import run_query

# These regexes are temporary since the DSL is supposed to be parsed internally by the snuba SDK, thus this
# is only bridging code to validate and evolve the metrics layer.
# TODO(layer): The layer should implement a grammar which parses queries using a custom DSL.
QUERY_REGEX = re.compile(r"(\w+):([^\s]+)(?:\s|$)")


class InvalidMetricsQuery(Exception):
    pass


ResultValue = Optional[Union[int, float]]
GroupKey = Tuple[Tuple[str, str], ...]
Series = List[Tuple[str, ResultValue]]
Total = ResultValue


@dataclass
class GroupValue:
    series: Series
    total: Total

    @classmethod
    def empty(cls) -> "GroupValue":
        return GroupValue(series=[], total=None)

    def add_series_entry(self, time: str, aggregate_value: ResultValue):
        self.series.append((time, aggregate_value))

    def add_total(self, total: ResultValue):
        self.total = total


@dataclass(frozen=True)
class QueryResult:
    name: str
    grouped_by: Optional[Sequence[str]]
    result: Mapping[str, Any]


def _parse_fields(
    fields: Sequence[str],
    filters: Optional[ConditionGroup],
    groupby: Optional[List[Union[Column, AliasedExpression]]],
) -> Generator[Timeseries, None, None]:
    """
    This function supports parsing in the form:
    aggregate(metric_name)
    """
    if not fields:
        raise InvalidMetricsQuery("You must query at least one field.")

    for field in fields:
        # As a first iteration, we leverage only a subset of the mql grammar to pass the basic expressions like
        # `aggregate(metric)` and then we inject the conditions that were parsed from the query passed with the old
        # discover grammar.
        timeseries = parse_mql(field).query
        yield timeseries.set_filters(filters).set_groupby(groupby)


def _parse_filters(query: Optional[str]) -> Optional[Sequence[Condition]]:
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
        filters.append(Condition(lhs=Column(name=key), op=Op.EQ, rhs=value))

    if not query:
        raise InvalidMetricsQuery("Error while parsing the query.")

    return filters


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
    start_seconds: int,
    num_intervals: int,
    interval: int,
    series: Series,
    null_value: ResultValue = None,
) -> Sequence[Optional[Union[int, float]]]:
    """
    Computes a full series over the entire requested interval with None set where there are no data points.
    """
    full_series = [null_value] * num_intervals
    for time, value in series:
        time_seconds = parse_datetime_string(time).timestamp()
        index = int((time_seconds - start_seconds) / interval)
        full_series[index] = value

    return full_series


def _get_identity(value: ResultValue) -> ResultValue:
    """
    Computes the identity of a value.

    For nan, we want to return None instead of 0.0 but this is just a design decision that conforms
    to the previous implementation of the layer.
    """
    if value is None:
        return None

    if math.isnan(value):
        return None

    # We might decide in the future to have identity values specific to each aggregate.
    return type(value)()


def _nan_to_none(value: ResultValue) -> ResultValue:
    """
    Converts a nan value to None or returns the original value.
    """
    if value is None:
        return None

    if math.isnan(value):
        return None

    return value


def _translate_query_results(
    interval: int,
    query_results: Sequence[QueryResult],
) -> Mapping[str, Any]:
    """
    Converts the default format from the metrics layer format into the old format which is understood by the frontend.
    """
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    intervals: Optional[Sequence[datetime]] = None

    # For efficiency reasons, we translate the incoming data into our custom in-memory representations.
    intermediate_groups: Dict[GroupKey, Dict[str, GroupValue]] = {}
    intermediate_meta: Dict[str, str] = {}
    for query_result in query_results:
        # Very ugly way to build the intervals start and end from the run queries, since they are all using
        # the same params.
        if start is None:
            start = query_result.result["modified_start"]
        if end is None:
            end = query_result.result["modified_end"]
        if intervals is None:
            intervals = _build_intervals(start, end, interval)

        def _group(values, block):
            for value in values:
                # We compute a list containing all the group values.
                grouped_values = []
                for group_by in query_result.grouped_by or ():
                    grouped_values.append((group_by, value.get(group_by)))

                # We order the group values in order to be consistent across executions.
                group_key = tuple(sorted(grouped_values))
                group_metrics = intermediate_groups.setdefault(group_key, {})
                # The item at position 0 is the "series".
                group_value = group_metrics.setdefault(query_result.name, GroupValue.empty())
                block(value, group_value)

        # We group the timeseries data.
        _group(
            query_result.result["data"],
            lambda value, group: group.add_series_entry(
                value.get("time"), value.get("aggregate_value")
            ),
        )

        # We group the total data.
        _group(
            query_result.result["totals"],
            lambda value, group: group.add_total(value.get("aggregate_value")),
        )

        meta = query_result.result["meta"]
        for meta_item in meta:
            meta_name = meta_item.get("name")
            meta_type = meta_item.get("type")

            # Since we have to handle multiple time series, we map the aggregate value to the actual
            # metric name that was queried.
            if meta_name == "aggregate_value":
                intermediate_meta[query_result.name] = meta_type
            else:
                intermediate_meta[meta_name] = meta_type

    translated_groups = []
    for group_key, group_metrics in sorted(intermediate_groups.items(), key=lambda v: v[0]):
        # This case should never happen, since if we have start and intervals not None
        assert start is not None and end is not None and intervals is not None

        start_seconds = int(start.timestamp())
        num_intervals = len(intervals)

        translated_serieses: Dict[str, Sequence[Optional[Union[int, float]]]] = {}
        translated_totals: Dict[str, ResultValue] = {}
        for metric_name, metric_values in sorted(group_metrics.items(), key=lambda v: v[0]):
            series = metric_values.series
            total = metric_values.total

            # We generate the full series by passing as default value the identity of the totals, which is the default
            # value applied in the timeseries.
            translated_serieses[metric_name] = _generate_full_series(
                start_seconds, num_intervals, interval, series, _get_identity(total)
            )
            # In case we get nan, we will cast it to None but this can be changed in case there is the need.
            translated_totals[metric_name] = _nan_to_none(total)

        inner_group = {
            "by": {name: value for name, value in group_key},
            "series": translated_serieses,
            "totals": translated_totals,
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


def _build_request(organization: Organization, referrer: str, query: MetricsQuery) -> Request:
    return Request(
        dataset=Dataset.Metrics.value,
        query=query,
        app_id="default",
        tenant_ids={"referrer": referrer, "organization_id": organization.id},
    )


def _execute_series_and_totals_query(
    organization: Organization, interval: int, referrer: str, base_query: MetricsQuery
) -> Mapping[str, Any]:
    # First we make the series query.
    query = base_query.set_rollup(Rollup(interval=interval))
    series_result = run_query(request=_build_request(organization, referrer, query))

    # TODO(layer): maybe totals will have to be handled by the layer, so that the time intervals will be
    #  inferred automatically, instead of doing the manual work here.
    # Second we make the totals query by taking the same modified interval computed by the series query.
    modified_start = series_result["modified_start"]
    modified_end = series_result["modified_end"]
    query = (
        base_query.set_start(modified_start).set_end(modified_end).set_rollup(Rollup(totals=True))
    )
    totals_result = run_query(request=_build_request(organization, referrer, query))

    return {**series_result, "totals": totals_result["data"]}


def run_metrics_query(
    fields: Sequence[str],
    query: Optional[str],
    group_bys: Optional[Sequence[str]],
    interval: int,
    start: datetime,
    end: datetime,
    organization: Organization,
    projects: Sequence[Project],
    referrer: str,
):
    base_scope = MetricsScope(
        org_ids=[organization.id],
        project_ids=[project.id for project in projects],
    )

    # Build the basic query that contains the metadata.
    base_query = MetricsQuery(
        start=start,
        end=end,
        scope=base_scope,
    )

    # We generate the filters and group bys which are going to be applied to each timeseries.
    filters = _parse_filters(query) if query else None
    groupby = [Column(group_by) for group_by in group_bys] if group_bys else None

    # For each field generate the query.
    query_results = []
    for timeseries in _parse_fields(fields, filters, groupby):
        query = base_query.set_query(timeseries)
        result = _execute_series_and_totals_query(organization, interval, referrer, query)
        query_results.append(
            QueryResult(
                name=f"{timeseries.aggregate}({timeseries.metric.mri or timeseries.metric.public_name})",
                # We pass the group bys since its more efficient for the transformation.
                grouped_by=group_bys,
                result=result,
            )
        )

    # We translate the result back to the pre-existing format.
    return _translate_query_results(interval=interval, query_results=query_results)
