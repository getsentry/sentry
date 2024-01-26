import math
from dataclasses import dataclass, replace
from datetime import datetime
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple, cast

import sentry_sdk
from snuba_sdk import Column, Direction, MetricsQuery, Request
from snuba_sdk.conditions import BooleanCondition, BooleanOp, Condition, Op

from sentry.models.organization import Organization
from sentry.sentry_metrics.querying.common import DEFAULT_QUERY_INTERVALS, SNUBA_QUERY_LIMIT
from sentry.sentry_metrics.querying.errors import (
    InvalidMetricsQueryError,
    MetricsQueryExecutionError,
)
from sentry.sentry_metrics.querying.types import GroupKey, GroupsCollection
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics import to_intervals
from sentry.snuba.metrics_layer.query import run_query
from sentry.utils import metrics
from sentry.utils.snuba import SnubaError


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
        """
        Executes the scheduled queries serially.
        """
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
