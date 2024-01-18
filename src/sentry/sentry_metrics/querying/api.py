import math
import re
from collections import OrderedDict
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from typing import Any, Dict, Generator, List, Mapping, Optional, Sequence, Tuple, cast

import sentry_sdk
from parsimonious.exceptions import IncompleteParseError
from snuba_sdk import Column, Direction, MetricsQuery, MetricsScope, Request, Rollup, Timeseries
from snuba_sdk.conditions import BooleanCondition, BooleanOp, Condition, Op
from snuba_sdk.mql.mql import parse_mql
from snuba_sdk.query_visitors import InvalidQueryError

from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.utils import parse_datetime_string
from sentry.sentry_metrics.querying.errors import (
    InvalidMetricsQueryError,
    MetricsQueryExecutionError,
)
from sentry.sentry_metrics.querying.types import (
    GroupKey,
    GroupsCollection,
    QueryExpression,
    ResultValue,
    Series,
    Total,
)
from sentry.sentry_metrics.querying.utils import remove_if_match
from sentry.sentry_metrics.querying.visitors import (
    EnvironmentsInjectionVisitor,
    QueryExpressionVisitor,
    ValidationVisitor,
)
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics import to_intervals
from sentry.snuba.metrics_layer.query import run_query
from sentry.utils import metrics
from sentry.utils.snuba import SnubaError

# Snuba can return at most 10.000 rows.
SNUBA_QUERY_LIMIT = 10000
# Intervals in seconds which are used by the product to query data.
DEFAULT_QUERY_INTERVALS = [
    60 * 60 * 24,  # 1 day
    60 * 60 * 12,  # 12 hours
    60 * 60 * 4,  # 4 hours
    60 * 60 * 2,  # 2 hours
    60 * 60,  # 1 hour
    60 * 30,  # 30 min
    60 * 5,  # 5 min
    60,  # 1 min
]


@dataclass(frozen=True)
class ExecutableQuery:
    with_series: bool
    with_totals: bool

    identifier: str
    metrics_query: MetricsQuery
    group_bys: Optional[Sequence[str]]
    order_by: Optional[str]
    limit: Optional[int]

    def replace_date_range(self, start: datetime, end: datetime) -> "ExecutableQuery":
        return replace(
            self,
            metrics_query=self.metrics_query.set_start(start).set_end(end),
        )

    def replace_limit(self, limit: int = SNUBA_QUERY_LIMIT) -> "ExecutableQuery":
        return replace(
            self,
            metrics_query=self.metrics_query.set_limit(limit),
        )

    def replace_interval(self, new_interval: int) -> "ExecutableQuery":
        return replace(
            self,
            metrics_query=self.metrics_query.set_rollup(
                replace(self.metrics_query.rollup, interval=new_interval)
            ),
        )

    def replace_order_by(self, direction: Direction) -> "ExecutableQuery":
        return replace(
            self,
            metrics_query=self.metrics_query.set_rollup(
                replace(self.metrics_query.rollup, interval=None, totals=True, orderby=direction)
            ),
        )

    def to_totals_query(self) -> "ExecutableQuery":
        return replace(
            self,
            metrics_query=self.metrics_query.set_rollup(
                # If an order_by is used, we must run a totals query.
                replace(self.metrics_query.rollup, interval=None, totals=True)
            ),
        )

    def add_group_filters(
        self,
        groups_collection: Optional[GroupsCollection],
    ) -> "ExecutableQuery":
        """
        Adds a series of filters to the query which will make sure that the results returned only belong to the supplied
        groups.

        The need for this filter arises because when executing multiple queries, we want to have the same groups
        returned, in order to make results consistent. Note that in case queries have different groups, some results
        might be missing, since the reference query dictates which values are returned during the alignment process.
        """
        if not groups_collection:
            return self

        # We perform a transformation in the form [(key_1 = value_1 AND key_2 = value_2) OR (key_3 = value_3)].
        snuba_filters = []
        for groups in groups_collection:
            inner_snuba_filters = []
            for filter_key, filter_value in groups:
                inner_snuba_filters.append(Condition(Column(filter_key), Op.EQ, filter_value))

            # In case we have more than one filter, we have to group them into an `AND`.
            if len(inner_snuba_filters) > 1:
                snuba_filters.append(BooleanCondition(BooleanOp.AND, inner_snuba_filters))
            else:
                snuba_filters.append(inner_snuba_filters[0])

        # In case we have more than one filter, we have to group them into an `OR`.
        if len(snuba_filters) > 1:
            snuba_filters = [BooleanCondition(BooleanOp.OR, snuba_filters)]

        original_filters = self.metrics_query.query.filters or []
        return replace(
            self,
            metrics_query=self.metrics_query.set_query(
                self.metrics_query.query.set_filters(original_filters + snuba_filters)
            ),
        )


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


def _extract_groups_from_seq(seq: Sequence[Mapping[str, Any]]) -> GroupsCollection:
    """
    Returns the groups from a sequence of rows returned by Snuba.

    Rows from Snuba are in the form [{"time": x, "aggregate_value": y, "group_1": z, "group_2": a}].
    """
    groups = []
    for data in seq:
        inner_group = []
        for key, value in data.items():
            # TODO: check if time can be used as a tag key.
            if key not in ["aggregate_value", "time"]:
                inner_group.append((key, value))

        if inner_group:
            groups.append(inner_group)

    return groups


def _build_composite_key_from_dict(
    data: Mapping[str, Any], alignment_keys: Sequence[str]
) -> Tuple[Tuple[str, str], ...]:
    """
    Builds a hashable composite key given a series of keys that are looked up in the supplied data.
    """
    composite_key = []
    for key in alignment_keys:
        if (value := data.get(key)) is not None:
            composite_key.append((key, value))

    return tuple(composite_key)


def _build_indexed_seq(
    seq: Sequence[Mapping[str, Any]], alignment_keys: Sequence[str]
) -> Mapping[GroupKey, int]:
    """
    Creates an inverted index on the supplied sequence of Snuba rows. The index is keyed by the composite key which is
    computed from a set of alignment keys that define the order in which the key is built.
    """
    indexed_seq = {}
    for index, data in enumerate(seq):
        composite_key = _build_composite_key_from_dict(data, alignment_keys)
        indexed_seq[composite_key] = index

    return indexed_seq


def _build_aligned_seq(
    seq: Sequence[Mapping[str, Any]],
    reference_seq: Sequence[Mapping[str, Any]],
    alignment_keys: Sequence[str],
    indexed_seq: Mapping[GroupKey, int],
) -> Sequence[Mapping[str, Any]]:
    """
    Aligns a sequence of rows to a reference sequence of rows by using reverse index which was built to speed up the
    alignment process.
    """
    aligned_seq = []

    for data in reference_seq:
        composite_key = _build_composite_key_from_dict(data, alignment_keys)
        index = indexed_seq.get(composite_key)
        if index is not None:
            aligned_seq.append(seq[index])

    return aligned_seq


@dataclass(frozen=True)
class QueryResult:
    series_executable_query: Optional[ExecutableQuery]
    totals_executable_query: Optional[ExecutableQuery]
    result: Mapping[str, Any]

    def __post_init__(self):
        assert self.series_executable_query or self.totals_executable_query

    @property
    def query_name(self) -> str:
        if self.series_executable_query:
            return self.series_executable_query.identifier

        if self.totals_executable_query:
            return self.totals_executable_query.identifier

        raise InvalidMetricsQueryError(
            "Unable to determine the query name for a result with no queries"
        )

    @property
    def modified_start(self) -> datetime:
        return self.result["modified_start"]

    @property
    def modified_end(self) -> datetime:
        return self.result["modified_end"]

    @property
    def interval(self) -> int:
        if not self.series_executable_query:
            raise MetricsQueryExecutionError(
                "You have to run a timeseries query in order to use the interval"
            )

        return self.series_executable_query.metrics_query.rollup.interval

    @property
    def series(self) -> Sequence[Mapping[str, Any]]:
        return self.result["series"]["data"]

    @property
    def totals(self) -> Sequence[Mapping[str, Any]]:
        return self.result["totals"]["data"]

    @property
    def meta(self) -> Sequence[Mapping[str, str]]:
        # By default, we extract the metadata from the totals query, if that is not there we extract from the series
        # query.
        meta_source = "totals" if "totals" in self.result else "series"
        return self.result[meta_source]["meta"]

    @property
    def groups(self) -> GroupsCollection:
        # We prefer to use totals to determine the groups that we received, since those are less likely to hit the limit
        # , and thus they will be more comprehensive. In case the query doesn't have totals, we have to use series.
        return _extract_groups_from_seq(self.totals or self.series)

    @property
    def group_bys(self) -> Optional[List[str]]:
        # We return the groups directly from the query and not the actual groups returned by the query. This is done so
        # that we can correctly render groups in case they are not returned from the db.
        return cast(
            Optional[List[str]],
            (
                cast(ExecutableQuery, self.series_executable_query or self.totals_executable_query)
            ).group_bys,
        )

    @property
    def length(self) -> int:
        # We try to see how many series results we got, since that is the query which is likely to surpass the limit.
        if "series" in self.result:
            return len(self.series)

        # If we have no series, totals will give us a hint of the size of the dataset.
        if "totals" in self.result:
            return len(self.totals)

        return 0

    def align_with(self, reference_query_result: "QueryResult") -> "QueryResult":
        """
        Aligns the series and totals results with a reference query.

        Note that the alignment performs a mutation of the current object.
        """
        # Alignment keys define the order in which fields are used for indexing purposes when aligning different
        # sequences.
        alignment_keys = reference_query_result.group_bys
        if not alignment_keys:
            return self

        # For timeseries, we want to align based on the time also, since group bys + time are the common values
        # across separate queries.
        indexed_series = _build_indexed_seq(self.series, alignment_keys + ["time"])
        indexed_totals = _build_indexed_seq(self.totals, alignment_keys)

        aligned_series = _build_aligned_seq(
            self.series, reference_query_result.series, alignment_keys + ["time"], indexed_series
        )
        aligned_totals = _build_aligned_seq(
            self.totals, reference_query_result.totals, alignment_keys, indexed_totals
        )

        if aligned_series:
            self.result["series"]["data"] = aligned_series
        if aligned_totals:
            self.result["totals"]["data"] = aligned_totals

        return self

    def align_series_to_totals(self) -> "QueryResult":
        """
        Aligns the series to the totals of the same query.

        Note that the alignment performs a mutation of the current object.
        """
        alignment_keys = self.group_bys
        if not alignment_keys:
            return self

        indexed_series: Dict[Tuple[Tuple[str, str], ...], List[int]] = {}
        for index, data in enumerate(self.series):
            composite_key = _build_composite_key_from_dict(data, alignment_keys)
            # Since serieses have also the time component, we store multiple indexes of multiple times for the same
            # group.
            indexed_series.setdefault(composite_key, []).append(index)

        aligned_series = []
        for data in self.totals:
            composite_key = _build_composite_key_from_dict(data, alignment_keys)
            indexes = indexed_series.get(composite_key)
            for index in indexes or ():
                aligned_series.append(self.series[index])

        if aligned_series:
            self.result["series"]["data"] = aligned_series

        return self


class VisitableQueryExpression:
    def __init__(self, query: QueryExpression):
        self._query = query
        self._visitors: List[QueryExpressionVisitor[QueryExpression]] = []

    def add_visitor(
        self, visitor: QueryExpressionVisitor[QueryExpression]
    ) -> "VisitableQueryExpression":
        """
        Adds a visitor to the query expression.

        The visitor can both perform mutations or not on the expression tree.
        """
        self._visitors.append(visitor)

        return self

    def get(self) -> QueryExpression:
        """
        Returns the mutated query expression after running all the visitors
        in the order of definition.

        Order preservation does matter, since downstream visitors might work under the
        assumption that upstream visitors have already been run.
        """
        query = self._query
        for visitor in self._visitors:
            query = visitor.visit(query)

        return query


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

    def _parse_mql(self, mql: str) -> VisitableQueryExpression:
        """
        Parses the field with the MQL grammar.
        """
        try:
            query = parse_mql(mql).query
        except InvalidQueryError as e:
            cause = e.__cause__
            if cause and isinstance(cause, IncompleteParseError):
                error_context = cause.text[cause.pos : cause.pos + 20]
                # We expose the entire MQL string to give more context when solving the error, since in the future we
                # expect that MQL will be directly fed into the endpoint instead of being built from the supplied
                # fields.
                raise InvalidMetricsQueryError(
                    f"The query '{mql}' could not be matched starting from '{error_context}...'"
                )

            raise InvalidMetricsQueryError("The supplied query is not valid")

        return VisitableQueryExpression(query=query)

    def generate_queries(
        self, environments: Sequence[Environment]
    ) -> Generator[Tuple[str, Timeseries], None, None]:
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
            yield (
                field,
                self._parse_mql(mql_query).add_visitor(ValidationVisitor())
                # We purposefully want to inject environments after the final query expression tree is expanded.
                .add_visitor(EnvironmentsInjectionVisitor(environments)).get(),
            )


class QueryExecutor:
    def __init__(self, organization: Organization, referrer: str):
        self._organization = organization
        self._referrer = referrer
        # Ordered list of the intervals that can be chosen by the executor. They are removed when tried, in order
        # to avoid an infinite recursion.
        self._interval_choices = sorted(DEFAULT_QUERY_INTERVALS)
        # List of queries scheduled for execution.
        self._scheduled_queries: List[ExecutableQuery] = []
        # Tracks the number of queries that have been executed (for measuring purposes).
        self._number_of_executed_queries = 0

    def _build_request(self, query: MetricsQuery) -> Request:
        """
        Builds a Snuba request given a MetricsQuery to execute.
        """
        return Request(
            # The dataset used here is arbitrary, since the `run_query` function will infer it internally.
            dataset=Dataset.Metrics.value,
            query=query,
            app_id="default",
            tenant_ids={"referrer": self._referrer, "organization_id": self._organization.id},
        )

    def _execute(
        self, executable_query: ExecutableQuery, is_reference_query: bool = False
    ) -> QueryResult:
        """
        Executes a query as series and/or totals and returns the result.
        """
        try:
            # We try to determine the interval of the query, which will be used to define clear time bounds for both
            # queries. This is done here since the metrics layer doesn't adjust the time for totals queries.
            # TODO: maybe we can find a way to tell the layer to use the interval in totals but just to honor the same
            #   time interval as used in the series query.
            interval = executable_query.metrics_query.rollup.interval
            if interval:
                modified_start, modified_end, _ = to_intervals(
                    executable_query.metrics_query.start,
                    executable_query.metrics_query.end,
                    interval,
                )
                if modified_start and modified_end:
                    executable_query = executable_query.replace_date_range(
                        modified_start, modified_end
                    )

            totals_executable_query = executable_query
            totals_result = None
            if executable_query.with_totals:
                # For totals queries, if there is a limit passed by the user, we will honor that and apply it only for
                # the reference query, since we want to load the data for all groups that are decided by the reference
                # query.
                if is_reference_query and executable_query.limit:
                    totals_executable_query = totals_executable_query.replace_limit(
                        executable_query.limit
                    )
                else:
                    totals_executable_query = totals_executable_query.replace_limit()

                if executable_query.order_by:
                    order_by_direction = Direction.ASC
                    if executable_query.order_by.startswith("-"):
                        order_by_direction = Direction.DESC

                    totals_executable_query = totals_executable_query.replace_order_by(
                        order_by_direction
                    )

                self._number_of_executed_queries += 1
                totals_result = run_query(
                    request=self._build_request(
                        totals_executable_query.to_totals_query().metrics_query
                    )
                )

            series_executable_query = executable_query
            series_result = None
            if executable_query.with_series:
                # For series queries, we always want to use the default limit.
                series_executable_query = series_executable_query.replace_limit()

                # There is a case in which we need to apply the totals groups directly on the series, which happens only
                # when the reference queries are executed. The reason for this is that if we don't filter the values,
                # we might hit the limit in the series query and lose data.
                if is_reference_query and totals_result:
                    series_executable_query = series_executable_query.add_group_filters(
                        _extract_groups_from_seq(totals_result["data"])
                    )

                self._number_of_executed_queries += 1
                series_result = run_query(
                    request=self._build_request(series_executable_query.metrics_query)
                )

            result = {}
            if series_result and totals_result:
                result = {
                    "series": series_result,
                    "totals": totals_result,
                    "modified_start": series_result["modified_start"],
                    "modified_end": series_result["modified_end"],
                }
            elif series_result:
                result = {
                    "series": series_result,
                    "modified_start": series_result["modified_start"],
                    "modified_end": series_result["modified_end"],
                }
            elif totals_result:
                result = {
                    "totals": totals_result,
                    "modified_start": totals_result["modified_start"],
                    "modified_end": totals_result["modified_end"],
                }

            return QueryResult(
                series_executable_query=series_executable_query,
                totals_executable_query=totals_executable_query,
                result=result,
            )
        except SnubaError as e:
            sentry_sdk.capture_exception(e)
            raise MetricsQueryExecutionError("An error occurred while executing the query")

    def _derive_next_interval(self, result: QueryResult) -> int:
        """
        Computes the best possible interval, given a fixed set of available intervals, which can fit in the limit
        of rows that Snuba can return.
        """
        # We try to estimate the number of groups.
        groups_number = len(result.groups)

        # We compute the ideal number of intervals that can fit with a given number of groups.
        intervals_number = math.floor(SNUBA_QUERY_LIMIT / groups_number)

        # We compute the optimal size of each interval in seconds.
        optimal_interval_size = math.floor(
            (result.modified_end - result.modified_start).total_seconds() / intervals_number
        )

        # Get the smallest interval that is larger than optimal out of a set of defined intervals in the product.
        for index, interval in enumerate(self._interval_choices):
            if interval >= optimal_interval_size:
                # We have to put the choice, otherwise we end up in an infinite recursion.
                self._interval_choices.pop(index)
                return interval

        raise MetricsQueryExecutionError(
            "Unable to find an interval to satisfy the query because too many results "
            "are returned"
        )

    def _find_reference_query(self) -> int:
        """
        Finds the reference query among the _schedule_queries.

        A reference query is the first query which is run, and it's used to determine the ordering of the follow-up
        queries.
        """
        if not self._scheduled_queries:
            raise InvalidMetricsQueryError(
                "Can't find a reference query because no queries were supplied"
            )

        for index, query in enumerate(self._scheduled_queries):
            if query.order_by:
                return index

        return 0

    def _serial_execute(self) -> Sequence[QueryResult]:
        """
        Executes serially all the queries that are supplied to the QueryExecutor.

        The execution will try to satisfy the query by dynamically changing its interval, in the case in which the
        Snuba limit is reached.
        """
        if not self._scheduled_queries:
            return []

        # We execute the first reference query which will dictate the order of the follow-up queries.
        reference_query = self._scheduled_queries.pop(self._find_reference_query())
        reference_query_result = self._execute(
            executable_query=reference_query, is_reference_query=True
        )

        # Case 1: we have fewer results that the limit. In this case we are free to run the follow-up queries under the
        # assumption that data doesn't change much between queries.
        if reference_query_result.length < SNUBA_QUERY_LIMIT:
            # Snuba supports order by only for totals, thus we need to align the series to the totals ordering before
            # we can run the other queries and align them on this reference query.
            reference_query_result.align_series_to_totals()

            results = [reference_query_result]
            reference_groups = reference_query_result.groups
            metrics.distribution(
                key="ddm.metrics_api.groups_cardinality", value=len(reference_groups)
            )

            for query in self._scheduled_queries:
                query_result = self._execute(
                    executable_query=query.add_group_filters(reference_groups),
                    is_reference_query=False,
                )

                query_result.align_with(reference_query_result)
                results.append(query_result)

            return results

        # Case 2: we have more results than the limit. In this case we want to determine a new interval that
        # will result in less than limit data points.
        new_interval = self._derive_next_interval(reference_query_result)

        # We update the scheduled queries to use the new interval. It's important to note that we also add back the
        # reference query, since we need to execute it again.
        self._scheduled_queries = [
            query.replace_interval(new_interval)
            for query in [reference_query] + self._scheduled_queries
        ]

        return self._serial_execute()

    def execute(self) -> Sequence[QueryResult]:
        results = self._serial_execute()
        metrics.distribution(
            key="ddm.metrics_api.queries_executed", value=self._number_of_executed_queries
        )

        return results

    def schedule(
        self,
        identifier: str,
        query: MetricsQuery,
        group_bys: Optional[Sequence[str]],
        order_by: Optional[str],
        limit: Optional[int],
    ):
        """
        Lazily schedules a query for execution.

        Note that this method won't execute the query, since it's lazy in nature.
        """
        executable_query = ExecutableQuery(
            with_series=True,
            with_totals=True,
            identifier=identifier,
            metrics_query=query,
            group_bys=group_bys,
            order_by=order_by,
            limit=limit,
        )
        self._scheduled_queries.append(executable_query)


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


def _translate_query_results(execution_results: List[QueryResult]) -> Mapping[str, Any]:
    """
    Converts the default format from the metrics layer format into the old format which is understood by the frontend.
    """
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    interval: Optional[int] = None

    # For efficiency reasons, we translate the incoming data into our custom in-memory representations.
    intermediate_groups: OrderedDict[GroupKey, OrderedDict[str, GroupValue]] = OrderedDict()
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

                group_metrics = intermediate_groups.setdefault(tuple(grouped_values), OrderedDict())
                group_value = group_metrics.setdefault(
                    execution_result.query_name, GroupValue.empty()
                )

                block(value, group_value)

        # We group the totals data first, since we want the order to be set by the totals.
        _group(
            execution_result.totals,
            lambda value, group: group.add_total(value.get("aggregate_value")),
        )

        # We group the series data second, which will use the already ordered dictionary entries added by the totals.
        _group(
            execution_result.series,
            lambda value, group: group.add_series_entry(
                value.get("time"), value.get("aggregate_value")
            ),
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
    # TODO: we might want to give users the ability to just run totals queries. In that case, we will have to build
    #   the logic that is able to not require an interval.
    assert start is not None and end is not None and interval is not None

    # We build the intervals that we will return to the API user.
    intervals = _build_intervals(start, end, interval)

    translated_groups = []
    for group_key, group_metrics in intermediate_groups.items():
        translated_serieses: Dict[str, Sequence[ResultValue]] = {}
        translated_totals: Dict[str, ResultValue] = {}
        for metric_name, metric_values in group_metrics.items():
            series = metric_values.series
            total = metric_values.total

            # We generate the full series by passing as default value the identity of the totals, which is the default
            # value applied in the timeseries.
            # This function already aligns the series by sorting it in ascending order so there is no need to have
            # the series elements sorted beforehand.
            translated_serieses[metric_name] = _generate_full_series(
                int(start.timestamp()), len(intervals), interval, series, _get_identity(total)
            )
            # In case we get nan, we will cast it to None but this can be changed in case there is the need.
            translated_totals[metric_name] = _nan_to_none(total)

        # The order of the keys is not deterministic in the nested dictionaries.
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
    interval: int,
    start: datetime,
    end: datetime,
    organization: Organization,
    projects: Sequence[Project],
    environments: Sequence[Environment],
    referrer: str,
    query: Optional[str] = None,
    group_bys: Optional[Sequence[str]] = None,
    order_by: Optional[str] = None,
    limit: Optional[int] = None,
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

    applied_order_by = False
    for field, timeseries in parser.generate_queries(environments=environments):
        query = base_query.set_query(timeseries).set_rollup(Rollup(interval=interval))

        # We will apply the order by if it only matches the field. This is done since for now we don't support a custom
        # since for order bys.
        query_order_by = None
        if order_by and field == order_by.removeprefix("-"):
            query_order_by = order_by
            applied_order_by = True

        # The identifier of the query is the field which it tries to fetch. It has been chosen as the identifier since
        # it's stable and uniquely identifies the query.
        executor.schedule(
            identifier=field, query=query, group_bys=group_bys, order_by=query_order_by, limit=limit
        )

    if order_by and not applied_order_by:
        raise InvalidMetricsQueryError(
            f"The supplied orderBy {order_by} is not matching with any field of the query"
        )

    with metrics.timer(
        key="ddm.metrics_api.queries_execution_time",
        tags={"with_order_by": (order_by is not None), "with_group_by": (group_bys is not None)},
    ):
        # Iterating over each result.
        results = []
        for result in executor.execute():
            results.append(result)

    # We translate the result back to the pre-existing format.
    return _translate_query_results(execution_results=results)
