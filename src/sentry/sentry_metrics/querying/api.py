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
from snuba_sdk.conditions import Condition, Op
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
class ExecutionResult:
    # This refers to the timeseries query, not the totals.
    query: MetricsQuery
    result: Mapping[str, Any]
    with_totals: bool

    @property
    def query_name(self) -> str:
        timeseries = self.query.query
        return f"{timeseries.aggregate}({timeseries.metric.mri or timeseries.metric.public_name})"

    @property
    def modified_start(self) -> datetime:
        return self.result["modified_start"]

    @property
    def modified_end(self) -> datetime:
        return self.result["modified_end"]

    @property
    def interval(self) -> int:
        return self.query.rollup.interval

    @property
    def group_bys(self) -> Sequence[str]:
        group_bys = []
        for group_by in self.query.query.groupby or ():
            if isinstance(group_by, Column):
                group_bys.append(group_by.name)
            elif isinstance(group_by, AliasedExpression):
                group_bys.append(group_by.exp.name)

        return group_bys

    @property
    def data(self) -> Mapping[str, Any]:
        return self.result["data"]

    @property
    def totals(self) -> Mapping[str, Any]:
        return self.result["totals"]

    @property
    def meta(self) -> Sequence[Mapping[str, str]]:
        return self.result["meta"]


class QueryParser:
    def __init__(
        self,
        fields: Sequence[str],
        query: Optional[str],
        group_bys: Optional[Sequence[str]],
    ):
        self._fields = fields
        self._query = query
        self._group_bys = group_bys

    def _parse_query(self) -> Optional[Sequence[Condition]]:
        """
        This function supports parsing in the form:
        key:value (_ key:value)?
        in which the only supported operator is AND until this logic is switched to the metrics layer.
        """
        if self._query is None:
            return None

        # TODO: implement parsing via the discover grammar.
        filters = []
        matches = QUERY_REGEX.findall(self._query)
        for key, value in matches:
            filters.append(Condition(lhs=Column(name=key), op=Op.EQ, rhs=value))

        if not self._query:
            raise InvalidMetricsQuery("Error while parsing the query.")

        return filters

    def _parse_group_bys(self) -> Optional[Sequence[Column]]:
        """
        Parses the group bys by converting them into a list of snuba columns.
        """
        if self._group_bys is None:
            return None

        return [Column(group_by) for group_by in self._group_bys]

    def parse_timeserieses(self) -> Generator[Timeseries, None, None]:
        """
        Parses the incoming fields with the MQL grammar.

        Note that for now the filters and groupy are passed in, since we want to still keep the filtering
        via the discover grammar.
        """
        if not self._fields:
            raise InvalidMetricsQuery("You must query at least one field.")

        # We first parse the filters and group bys, which are then going to be applied on each individual query
        # that is executed.
        filters = self._parse_query()
        group_bys = self._parse_group_bys()

        for field in self._fields:
            timeseries = parse_mql(field).query
            yield timeseries.set_filters(filters).set_groupby(group_bys)


class QueryExecutor:
    def __init__(self, organization: Organization, referrer: str):
        self._organization = organization
        self._referrer = referrer
        # List of queries scheduled for execution.
        self._scheduled_queries: List[Tuple[MetricsQuery, bool]] = []

    def _build_request(self, query: MetricsQuery) -> Request:
        return Request(
            dataset=Dataset.Metrics.value,
            query=query,
            app_id="default",
            tenant_ids={"referrer": self._referrer, "organization_id": self._organization.id},
        )

    def _execute(self, query: MetricsQuery, with_totals: bool) -> Mapping[str, Any]:
        series_result = run_query(request=self._build_request(query))

        if with_totals:
            # TODO(layer): maybe totals will have to be handled by the layer, so that the time intervals will be
            #  inferred automatically, instead of doing the manual work here.
            modified_start = series_result["modified_start"]
            modified_end = series_result["modified_end"]
            query = (
                query.set_start(modified_start)
                .set_end(modified_end)
                .set_rollup(Rollup(totals=True))
            )
            totals_result = run_query(request=self._build_request(query))

            return {**series_result, "totals": totals_result["data"]}

        return series_result

    def schedule(self, query: MetricsQuery, with_totals: bool = True):
        # By default we want to execute totals.
        self._scheduled_queries.append((query, with_totals))

    def execute(self, in_batch: bool = False) -> Generator[ExecutionResult, None, None]:
        if in_batch:
            # TODO: implement batching.
            # Run batch query and flatten results.
            pass
        else:
            for query, with_totals in self._scheduled_queries:
                result = self._execute(query, with_totals)
                yield ExecutionResult(query=query, result=result, with_totals=with_totals)


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


def _translate_query_results(execution_results: List[ExecutionResult]) -> Mapping[str, Any]:
    """
    Converts the default format from the metrics layer format into the old format which is understood by the frontend.
    """
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    interval: Optional[int] = None

    # For efficiency reasons, we translate the incoming data into our custom in-memory representations.
    intermediate_groups: Dict[GroupKey, Dict[str, GroupValue]] = {}
    intermediate_meta: Dict[str, str] = {}
    for execution_result in execution_results:
        # All queries must have the same timerange, so under this assumption we take the first occurrence of each.
        if start is None:
            start = execution_result.modified_start
        if end is None:
            end = execution_result.modified_end
        if interval is None:
            interval = execution_result.interval

        def _group(values, block):
            for value in values:
                # We compute a list containing all the group values.
                grouped_values = []
                for group_by in execution_result.group_bys or ():
                    grouped_values.append((group_by, value.get(group_by)))

                # We order the group values in order to be consistent across executions.
                group_key = tuple(sorted(grouped_values))
                group_metrics = intermediate_groups.setdefault(group_key, {})
                # The item at position 0 is the "series".
                group_value = group_metrics.setdefault(
                    execution_result.query_name, GroupValue.empty()
                )
                block(value, group_value)

        # We group the timeseries data.
        _group(
            execution_result.data,
            lambda value, group: group.add_series_entry(
                value.get("time"), value.get("aggregate_value")
            ),
        )

        # We group the total data.
        _group(
            execution_result.totals,
            lambda value, group: group.add_total(value.get("aggregate_value")),
        )

        meta = execution_result.meta
        for meta_item in meta:
            meta_name = meta_item["name"]
            meta_type = meta_item["type"]

            # Since we have to handle multiple time series, we map the aggregate value to the actual
            # metric name that was queried.
            if meta_name == "aggregate_value":
                intermediate_meta[execution_result.query_name] = meta_type
            else:
                intermediate_meta[meta_name] = meta_type

    # If we don't have time bounds and an interval, we can't return anything.
    assert start is not None and end is not None and interval is not None

    # We build the intervals that we will return to the API user.
    intervals = _build_intervals(start, end, interval)

    translated_groups = []
    for group_key, group_metrics in sorted(intermediate_groups.items(), key=lambda v: v[0]):
        translated_serieses: Dict[str, Sequence[Optional[Union[int, float]]]] = {}
        translated_totals: Dict[str, ResultValue] = {}
        for metric_name, metric_values in sorted(group_metrics.items(), key=lambda v: v[0]):
            series = metric_values.series
            total = metric_values.total

            # We generate the full series by passing as default value the identity of the totals, which is the default
            # value applied in the timeseries.
            translated_serieses[metric_name] = _generate_full_series(
                int(start.timestamp()), len(intervals), interval, series, _get_identity(total)
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
    # Build the basic query that contains the metadata.
    base_query = MetricsQuery(
        start=start,
        end=end,
        scope=MetricsScope(
            org_ids=[organization.id],
            project_ids=[project.id for project in projects],
        ),
    )

    # Preparing the executor, that will be responsible for scheduling the execution multiple queries.
    executor = QueryExecutor(organization=organization, referrer=referrer)

    # Parsing the input and iterating over each timeseries.
    parser = QueryParser(fields=fields, query=query, group_bys=group_bys)
    for timeseries in parser.parse_timeserieses():
        query = base_query.set_query(timeseries).set_rollup(Rollup(interval=interval))
        executor.schedule(query)

    # Iterating over each result.
    results = []
    for result in executor.execute():
        results.append(result)

    # We translate the result back to the pre-existing format.
    return _translate_query_results(execution_results=results)
