import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Generator, List, Mapping, Optional, Sequence, Tuple, Union

from sentry_kafka_schemas.codecs import ValidationError
from snuba_sdk import Column, Metric, MetricsQuery, MetricsScope, Request, Rollup, Timeseries
from snuba_sdk.conditions import Condition, Op

from sentry.api.utils import InvalidParams
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.utils import parse_datetime_string
from sentry.sentry_metrics.use_case_id_registry import UseCaseID, extract_use_case_id
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.naming_layer.mapping import get_mri, is_mri
from sentry.snuba.metrics_layer.query import run_query

# These regexes are temporary since the DSL is supposed to be parsed internally by the snuba SDK, thus this
# is only bridging code to validate and evolve the metrics layer.
# TODO(layer): The layer should implement a grammar which parses queries using a custom DSL.
FIELD_REGEX = re.compile(r"^(\w+)\(([^\s)]+)\)$")
QUERY_REGEX = re.compile(r"(\w+):([^\s]+)")


class InvalidMetricsQuery(Exception):
    pass


@dataclass(frozen=True)
class QueryResult:
    name: str
    grouped_by: Optional[Sequence[str]]
    result: Mapping[str, Any]


def _parse_fields(fields: Sequence[str]) -> Generator[Timeseries, None, None]:
    """
    This function supports parsing in the form:
    aggregate(metric_name)
    """
    if not fields:
        raise InvalidMetricsQuery("You must query at least one field.")

    for field in fields:
        match = FIELD_REGEX.match(field)
        if match is None:
            raise InvalidMetricsQuery(f"The field {field} can't be parsed.")

        aggregate = match.group(1)
        metric_name = match.group(2)

        if is_mri(metric_name):
            metric = Metric(mri=metric_name)
        else:
            metric = Metric(public_name=metric_name)

        yield Timeseries(metric=metric, aggregate=aggregate)


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
    # TODO(layer): The layer should not only return the intervals with data but also an array of intervals that were
    #  considered by the query (e.g., all the intervals between start and end).
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
    query_results: Sequence[QueryResult],
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
    for query_result in query_results:
        # Very ugly way to build the intervals start and end from the run queries, since they are all using
        # the same params.
        if start is None:
            start = query_result.result["modified_start"]
        if end is None:
            end = query_result.result["modified_end"]
        if intervals is None:
            intervals = _build_intervals(start, end, interval)

        data = query_result.result["data"]
        for data_item in data:
            grouped_values = []
            for group_by in query_result.grouped_by or ():
                grouped_values.append((group_by, data_item.get(group_by)))

            # The group key must be ordered, in order to be consistent across executions.
            group_key = tuple(sorted(grouped_values))
            group_metrics = intermediate_groups.setdefault(group_key, {})
            metric_values = group_metrics.setdefault(query_result.name, [[], 0])
            # The item at position 0 is the "series".
            metric_values[0].append((data_item.get("time"), data_item.get("aggregate_value")))

        # TODO: reduce duplication.
        totals = query_result.result["totals"]
        for totals_item in totals:
            grouped_values = []
            for group_by in query_result.grouped_by or ():
                grouped_values.append((group_by, totals_item.get(group_by)))

            # The group key must be ordered, in order to be consistent across executions.
            group_key = tuple(sorted(grouped_values))
            group_metrics = intermediate_groups.setdefault(group_key, {})
            metric_values = group_metrics.setdefault(query_result.name, [[], 0])
            # The item at position 1 is the "totals".
            metric_values[1] = totals_item.get("aggregate_value")

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


def _build_request(organization: Organization, query: MetricsQuery) -> Request:
    dataset = (
        Dataset.Metrics
        if query.scope.use_case_id == UseCaseID.SESSIONS.value
        else Dataset.PerformanceMetrics
    )
    return Request(
        dataset=dataset.value,
        query=query,
        app_id="default",
        tenant_ids={"referrer": "metrics.data", "organization_id": organization.id},
    )


def _infer_use_case_id_from_timeseries(timeseries: Timeseries) -> UseCaseID:
    if timeseries.metric.mri is not None:
        mri = timeseries.metric.mri
    else:
        mri = get_mri(timeseries.metric.public_name)

    try:
        return extract_use_case_id(mri)
    except ValidationError:
        raise InvalidParams(f"The query contains an invalid MRI: {mri}")


def _execute_series_and_totals_query(
    organization: Organization, interval: int, base_query: MetricsQuery
) -> Mapping[str, Any]:
    # We infer the use case id from the timeseries.
    inferred_use_case_id = _infer_use_case_id_from_timeseries(base_query.query)
    extended_scope = base_query.scope.set_use_case_id(inferred_use_case_id.value)
    base_query = base_query.set_scope(extended_scope)

    # First we make the series query.
    query = base_query.set_rollup(Rollup(interval=interval))
    series_result = run_query(request=_build_request(organization, query))

    # Second we make the totals query by taking the same modified interval computed by the series query.
    modified_start = series_result["modified_start"]
    modified_end = series_result["modified_end"]
    query = (
        base_query.set_start(modified_start).set_end(modified_end).set_rollup(Rollup(totals=True))
    )
    totals_result = run_query(request=_build_request(organization, query))

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
):
    base_scope = MetricsScope(
        org_ids=[organization.id],
        project_ids=[project.id for project in projects],
    )

    # Build the basic query that contains the metadata.
    base_query = MetricsQuery(
        filters=_parse_filters(query) if query else None,
        groupby=[Column(group_by) for group_by in group_bys] if group_bys else None,
        start=start,
        end=end,
        scope=base_scope,
    )

    # For each field generate the query.
    query_results = []
    for timeseries in _parse_fields(fields):
        query = base_query.set_query(timeseries)
        result = _execute_series_and_totals_query(organization, interval, query)
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
