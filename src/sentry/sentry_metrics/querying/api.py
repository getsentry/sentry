import math
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Generator, List, Mapping, Optional, Sequence, Tuple, Union

import sentry_sdk
from snuba_sdk import (
    AliasedExpression,
    Column,
    MetricsQuery,
    MetricsScope,
    Request,
    Rollup,
    Timeseries,
)
from snuba_sdk.conditions import BooleanCondition, BooleanOp, Condition, ConditionGroup, Op
from snuba_sdk.mql.mql import parse_mql
from snuba_sdk.query_visitors import InvalidQueryError

from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.utils import parse_datetime_string
from sentry.sentry_metrics.querying.utils import remove_if_match
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics_layer.query import run_query
from sentry.utils.snuba import SnubaError


class InvalidMetricsQueryError(Exception):
    pass


class MetricsQueryExecutionError(Exception):
    pass


# Type representing the aggregate value from Snuba, which can be null, int, float or list.
ResultValue = Optional[Union[int, float, List[Optional[Union[int, float]]]]]
# Type representing a series of values with (`time`, `value`) pairs.
Series = List[Tuple[str, ResultValue]]
# Type representing a single aggregate value.
Total = ResultValue
# Type representing the group key as a tuple of tuples ((`key_1`, `value_1`), (`key_2, `value_2), ...)
GroupKey = Tuple[Tuple[str, str], ...]


@dataclass
class GroupValue:
    series: Series
    total: Total

    @classmethod
    def empty(cls) -> "GroupValue":
        return GroupValue(series=[], total=None)

    def add_series_entry(self, time: str, aggregate_value: ResultValue):
        self.series.append((time, self._transform_aggregate_value(aggregate_value)))

    def add_total(self, aggregate_value: ResultValue):
        self.total = self._transform_aggregate_value(aggregate_value)

    def _transform_aggregate_value(self, aggregate_value: ResultValue):
        # For now, we don't support the array return type, since the set of operations that the API can support
        # won't lead to multiple values in a single aggregate value. For this reason, we extract the first value
        # in case we get back an array of values, which can happen for multiple quantiles.
        if isinstance(aggregate_value, list):
            if aggregate_value:
                return aggregate_value[0]

            raise MetricsQueryExecutionError("Received an empty array as aggregate value")

        return aggregate_value


@dataclass
class QueryMeta:
    name: str
    type: str

    def __post_init__(self):
        self._transform_meta_type()

    def _transform_meta_type(self):
        # Since we don't support the array aggregate value, and we return the first element, we just return the type of
        # the values of the array.
        if self.type.startswith("Array("):
            self.type = self.type[6 : len(self.type) - 1]


@dataclass(frozen=True)
class ExecutionResult:
    # This is the timeseries query that is being passed to the metrics layer, thus it doesn't contain any
    # mutations that the layer might do.
    query: MetricsQuery
    result: Mapping[str, Any]
    with_totals: bool

    @property
    def query_name(self) -> str:
        timeseries = self.query.query

        aggregate = timeseries.aggregate
        metric = timeseries.metric.mri or timeseries.metric.public_name

        return f"{aggregate}({metric})"

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


class MutableTimeseries:
    def __init__(self, timeseries: Timeseries):
        self._timeseries = timeseries

        self._validate()

    def _validate_filters(self, filters: Optional[ConditionGroup]):
        for f in filters or ():
            if isinstance(f, BooleanCondition):
                if f.op == BooleanOp.OR:
                    raise InvalidMetricsQueryError("The OR operator is not supported")

                self._validate_filters(f.conditions)

    def _validate(self):
        self._validate_filters(self._timeseries.filters)

    def inject_environments(self, environments: Sequence[Environment]) -> "MutableTimeseries":
        if environments:
            environment_names = [environment.name for environment in environments]
            existing_filters = self._timeseries.filters[:] if self._timeseries.filters else []
            self._timeseries = self._timeseries.set_filters(
                existing_filters + [Condition(Column("environment"), Op.IN, environment_names)]
            )

        return self

    def get_mutated(self) -> Timeseries:
        return self._timeseries


class QueryParser:
    # We avoid having the filters expression to be closed or opened.
    FILTERS_SANITIZATION_PATTERN = re.compile(r"[{}]$")
    # We avoid to have any way of opening and closing other expressions.
    GROUP_BYS_SANITIZATION_PATTERN = re.compile(r"[(){}\[\]]")

    def __init__(
        self,
        fields: Sequence[str],
        query: Optional[str],
        group_bys: Optional[Sequence[str]],
    ):
        self._fields = fields
        self._query = query
        self._group_bys = group_bys

        # We want to sanitize the input in order to avoid any injection attacks due to the string interpolation that
        # it's performed when building the MQL query.
        self._sanitize()

    def _sanitize(self):
        """
        Sanitizes the query and group bys before using them to build the MQL query.
        """
        if self._query:
            self._query = remove_if_match(self.FILTERS_SANITIZATION_PATTERN, self._query)

        if self._group_bys:
            self._group_bys = [
                remove_if_match(self.GROUP_BYS_SANITIZATION_PATTERN, group_by)
                for group_by in self._group_bys
            ]

    def _build_mql_filters(self) -> Optional[str]:
        """
        Builds a set of MQL filters from a single query string.

        In this case the query passed, is assumed to be already compatible with the filters grammar of MQL, thus no
        transformation are performed.
        """
        if not self._query:
            return None

        return self._query

    def _build_mql_group_bys(self) -> Optional[str]:
        """
        Builds a set of MQL group by filters from a list of strings.
        """
        if not self._group_bys:
            return None

        return ",".join(self._group_bys)

    def _build_mql_query(self, field: str, filters: Optional[str], group_bys: Optional[str]) -> str:
        """
        Builds an MQL query string in the form `aggregate(metric){tag_key:tag_value} by (group_by_1, group_by_2).
        """
        mql = field

        if filters is not None:
            mql += f"{{{filters}}}"

        if group_bys is not None:
            mql += f" by ({group_bys})"

        return mql

    def _parse_mql(self, mql: str) -> MutableTimeseries:
        """
        Parses the field with the MQL grammar.
        """
        try:
            timeseries = parse_mql(mql).query
        except InvalidQueryError as e:
            raise InvalidMetricsQueryError(f"The supplied query is not valid: {type(e).__name__}")

        return MutableTimeseries(timeseries=timeseries)

    def generate_queries(
        self, environments: Sequence[Environment]
    ) -> Generator[Timeseries, None, None]:
        """
        Generates multiple timeseries queries given a base query.
        """
        if not self._fields:
            raise InvalidMetricsQueryError("You must query at least one field")

        # We first parse the filters and group bys, which are then going to be applied on each individual query
        # that is executed.
        mql_filters = self._build_mql_filters()
        mql_group_bys = self._build_mql_group_bys()

        for field in self._fields:
            mql_query = self._build_mql_query(field, mql_filters, mql_group_bys)
            yield self._parse_mql(mql_query).inject_environments(environments).get_mutated()


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
        try:
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
        except SnubaError as e:
            sentry_sdk.capture_exception(e)
            raise MetricsQueryExecutionError(
                f"An error occurred while executing the query: {type(e).__name__}"
            )

    def schedule(self, query: MetricsQuery, with_totals: bool = True):
        # By default we want to execute totals.
        self._scheduled_queries.append((query, with_totals))

    def execute(self, batch: bool = False) -> Generator[ExecutionResult, None, None]:
        if batch:
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
) -> Sequence[ResultValue]:
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

    if _is_nan(value):
        return None

    # We might decide in the future to have identity values specific to each aggregate.
    return type(value)()


def _nan_to_none(value: ResultValue) -> ResultValue:
    """
    Converts a nan value to None or returns the original value.
    """
    if value is None:
        return None

    if _is_nan(value):
        return None

    return value


def _is_nan(value: ResultValue) -> bool:
    """
    Returns whether the result of a query is nan.
    """
    if value is None:
        return False
    elif isinstance(value, list):
        return any(map(lambda e: e is not None and math.isnan(e), value))

    return math.isnan(value)


def _translate_query_results(execution_results: List[ExecutionResult]) -> Mapping[str, Any]:
    """
    Converts the default format from the metrics layer format into the old format which is understood by the frontend.
    """
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    interval: Optional[int] = None

    # For efficiency reasons, we translate the incoming data into our custom in-memory representations.
    intermediate_groups: Dict[GroupKey, Dict[str, GroupValue]] = {}
    intermediate_meta: List[QueryMeta] = []
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

            # The meta of each query, contains the metadata for each field in the result. In this case, we want to map
            # the aggregate value type to the actual query name, which is used from the outside to recognize the query.
            name = execution_result.query_name if meta_name == "aggregate_value" else meta_name
            intermediate_meta.append(QueryMeta(name=name, type=meta_type))

    # If we don't have time bounds and an interval, we can't return anything.
    assert start is not None and end is not None and interval is not None

    # We build the intervals that we will return to the API user.
    intervals = _build_intervals(start, end, interval)

    translated_groups = []
    for group_key, group_metrics in sorted(intermediate_groups.items(), key=lambda v: v[0]):
        translated_serieses: Dict[str, Sequence[ResultValue]] = {}
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

    translated_meta = [{"name": meta.name, "type": meta.type} for meta in intermediate_meta]

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
    environments: Sequence[Environment],
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
    for timeseries in parser.generate_queries(environments=environments):
        query = base_query.set_query(timeseries).set_rollup(Rollup(interval=interval))
        executor.schedule(query)

    # Iterating over each result.
    results = []
    for result in executor.execute():
        results.append(result)

    # We translate the result back to the pre-existing format.
    return _translate_query_results(execution_results=results)
