from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field, replace
from datetime import datetime
from enum import Enum
from typing import Any, Union, cast

import sentry_sdk
from snuba_sdk import Column, Direction, MetricsQuery, Request
from snuba_sdk.conditions import BooleanCondition, BooleanOp, Condition, Op

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.constants import SNUBA_QUERY_LIMIT
from sentry.sentry_metrics.querying.data.mapping.base import Mapper
from sentry.sentry_metrics.querying.data.preparation.base import IntermediateQuery
from sentry.sentry_metrics.querying.data.utils import adjust_time_bounds_with_interval
from sentry.sentry_metrics.querying.errors import (
    InvalidMetricsQueryError,
    MetricsQueryExecutionError,
)
from sentry.sentry_metrics.querying.types import GroupsCollection, QueryOrder, QueryType
from sentry.sentry_metrics.querying.units import MeasurementUnit, UnitFamily
from sentry.sentry_metrics.querying.visitors import (
    TimeseriesConditionInjectionVisitor,
    UsedGroupBysVisitor,
)
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics_layer.query import bulk_run_query
from sentry.utils import metrics
from sentry.utils.snuba import SnubaError


def _extract_groups_from_seq(seq: Sequence[Mapping[str, Any]]) -> GroupsCollection:
    """
    Extracts all groups from a series of results.

    An example element of the sequence is {"time": x, "aggregate_value": y, "group_1": z, "group_2": a} which will be
    transformed into [("group_1", z), ("group_2", a)].

    Returns:
        The extracted groups from the sequence as a list containing lists of tuples.
    """
    groups = []
    for data in seq:
        inner_group = []
        for key, value in data.items():
            if key not in ["aggregate_value", "time"]:
                inner_group.append((key, value))

        if inner_group:
            groups.append(inner_group)

    return groups


def _build_composite_key_from_dict(
    data: Mapping[str, Any], alignment_keys: Sequence[str]
) -> tuple[tuple[str, str], ...]:
    """
    Builds a hashable composite key given a series of keys that are looked up in the supplied data.

    Returns:
        A tuple containing pairs of group key and group value.
    """
    composite_key = []
    for key in alignment_keys:
        if (value := data.get(key)) is not None:
            composite_key.append((key, value))

    return tuple(composite_key)


def _push_down_group_filters(
    metrics_query: MetricsQuery, groups_collection: GroupsCollection | None
) -> MetricsQuery:
    """
    Pushes down group filters to each component of the MetricsQuery.

    The need for these filters arises because when executing multiple queries, we want to have the same groups
    returned, in order to make results consistent.

    Keep in mind that there is no guarantee that all the groups will be returned, since data might change in the
    meanwhile, so the guarantee of this method is that the returned groups will all belong to `groups_collection`.

    Returns:
        A new MetricsQuery with the group filters applied.
    """
    if not groups_collection:
        return metrics_query

    # We perform a transformation in the form [(key_1 = value_1 AND key_2 = value_2) OR (key_3 = value_3)].
    groups_filters = []
    for groups in groups_collection:
        inner_snuba_filters = []
        for filter_key, filter_value in groups:
            inner_snuba_filters.append(Condition(Column(filter_key), Op.EQ, filter_value))

        # In case we have more than one filter, we have to group them into an `AND`.
        if len(inner_snuba_filters) > 1:
            groups_filters.append(BooleanCondition(BooleanOp.AND, inner_snuba_filters))
        else:
            groups_filters.append(inner_snuba_filters[0])

    # In case we have more than one filter, we have to group them into an `OR`.
    if len(groups_filters) > 1:
        groups_filters = [BooleanCondition(BooleanOp.OR, groups_filters)]

    merged_query = TimeseriesConditionInjectionVisitor(groups_filters).visit(metrics_query.query)
    return metrics_query.set_query(merged_query)


class ScheduledQueryType(Enum):
    """
    Represents the type of query that needs to be scheduled for execution.
    """

    SERIES = 0
    TOTALS = 1


@dataclass(frozen=True)
class ScheduledQuery:
    """
    Represents a query that needs to be scheduled for execution.

    Attributes:
        type: The type of the query that needs to be run.
        metrics_query: The query that needs to be run.
        next: The next query that has a dependency with this, meaning that the executor will execute them serially.
        order: The order of the groups that are returned.
        limit: The maximum number of groups to return.
        dynamic_limit: True if the query is using the dynamic limit determined during initialization.
        unit_family: The UnitFamily of the query.
        unit: The unit of the query.
        scaling_factor: The scaling factor that was applied on the query to normalize it to unit.
    """

    type: ScheduledQueryType
    metrics_query: MetricsQuery
    next: Union["ScheduledQuery", None] = None
    order: QueryOrder | None = None
    limit: int | None = None
    dynamic_limit: bool = False
    unit_family: UnitFamily | None = None
    unit: MeasurementUnit | None = None
    scaling_factor: float | None = None
    mappers: list[Mapper] = field(default_factory=list)

    def initialize(
        self,
        organization: Organization,
        projects: Sequence[Project],
    ) -> "ScheduledQuery":
        """
        Initializes the query via a series of transformations that prepare it for being executed.

        Returns:
            A new ScheduledQuery with all the transformations applied.
        """
        updated_metrics_query = self.metrics_query

        # We align the date range of the query, considering the supplied interval. We also return
        # the number of intervals request, which will be used later on to compute the dynamic groups in case no limit
        # is supplied.
        updated_metrics_query, intervals_number = self._align_date_range(updated_metrics_query)

        # We perform type-specific initializations, since based on the type we want to run
        # a different query.
        dynamic_limit = False
        if self.type == ScheduledQueryType.SERIES:
            updated_metrics_query = self._initialize_series(updated_metrics_query)
        elif self.type == ScheduledQueryType.TOTALS:
            updated_metrics_query, dynamic_limit = self._initialize_totals(
                updated_metrics_query, intervals_number
            )

        # We recursively apply the initialization transformations downstream.
        updated_next = None
        if self.next is not None:
            updated_next = self.next.initialize(organization, projects)

        return replace(
            self,
            metrics_query=updated_metrics_query,
            next=updated_next,
            dynamic_limit=dynamic_limit,
        )

    def _initialize_series(self, metrics_query: MetricsQuery) -> MetricsQuery:
        """
        Initializes the query as if it was a timeseries query.

        Returns:
            A new MetricsQuery with the required transformations for being executed as a timeseries query.
        """
        updated_metrics_query = metrics_query

        # A series query runs always up to the maximum query limit.
        updated_metrics_query = updated_metrics_query.set_limit(SNUBA_QUERY_LIMIT)

        return updated_metrics_query

    def _initialize_totals(
        self, metrics_query: MetricsQuery, intervals_number: int | None
    ) -> tuple[MetricsQuery, bool]:
        """
        Initializes the query as if it was a totals query.

        Returns:
            A new MetricsQuery with the required transformations for being executed as a totals query.
        """
        updated_metrics_query = metrics_query

        # A totals query doesn't have an interval.
        updated_metrics_query = updated_metrics_query.set_rollup(
            replace(updated_metrics_query.rollup, interval=None, totals=True)
        )

        if self.order:
            updated_metrics_query = updated_metrics_query.set_rollup(
                replace(updated_metrics_query.rollup, orderby=self.order.to_snuba_order())
            )

        limit = self.limit
        dynamic_limit = False
        if limit is None and intervals_number is not None:
            # If no limit is specified, we want to compute the optimal number of groups rounded down. The idea is that
            # if you have a 10k limit of rows returned by Snuba and you request an interval of 100 elements, Snuba can
            # return you at most 100 groups, thus that will be the limit chosen for the totals query. This means that
            # the executor will load 100 entries from totals which will result in the worst case in 100 * 100 = 10k
            # entries in the series query.
            limit = SNUBA_QUERY_LIMIT // intervals_number
            if limit <= 0:
                raise InvalidMetricsQueryError("Your date range contains too many intervals")

            # We want to increase the limit by 1 to have a lookahead to determine whether more groups exist.
            limit += 1
            dynamic_limit = True

        if limit is not None:
            # We want to modify only the limit of the actual query and not the one of the `ScheduledQuery` since we want
            # to keep that as it was supplied by the executor.
            updated_metrics_query = updated_metrics_query.set_limit(min(limit, SNUBA_QUERY_LIMIT))

        return updated_metrics_query, dynamic_limit

    @classmethod
    def _align_date_range(cls, metrics_query: MetricsQuery) -> tuple[MetricsQuery, int | None]:
        """
        Aligns the date range of the query to the outermost bounds of the interval time range considering the interval.

        For example, if we were to query from 09:30 to 11:30 with 1 hour of interval, the new aligned date range would
        be 09:00 to 12:00. This is done so that we can use higher granularities at the storage later to satisfy the
        query since now we can use 3 buckets of 1 hour but if we were to keep the original interval, we were forced to
        query all the minutes between 9:30 and 11:30 since the biggest granularity < hour is minute.

        Returns:
            A new MetricsQuery with the aligned date range and the numbers of the intervals.
        """
        # We use as a reference the interval supplied via the initial version of the query.
        interval = metrics_query.rollup.interval
        if interval:
            modified_start, modified_end, intervals_number = adjust_time_bounds_with_interval(
                metrics_query.start,
                metrics_query.end,
                interval,
            )
            return (
                metrics_query.set_start(modified_start).set_end(modified_end),
                intervals_number,
            )

        return metrics_query, None


@dataclass
class QueryResult:
    """
    Represents the result of a ScheduledQuery containing its associated series and totals results.

    Attributes:
        has_more: True if the query has more groups stored than they were returned. This is used in conjunction with
            dynamic limiting.
    """

    series_query: ScheduledQuery | None
    totals_query: ScheduledQuery | None
    result: Mapping[str, Any]
    has_more: bool

    def __post_init__(self):
        if not self.series_query and not self.totals_query:
            raise MetricsQueryExecutionError(
                "A query result must contain at least one series or totals query"
            )

    @classmethod
    def from_scheduled_query(
        cls, scheduled_query: ScheduledQuery, query_result: Mapping[str, Any], has_more: bool
    ) -> "QueryResult":
        """
        Creates a QueryResult from a ScheduledQuery.

        Returns:
            A QueryResult which contains the scheduled query and its results.
        """
        # We add these fields as top level, so that when merging `QueryResult`(s) we are able to do that easily.
        extended_result = {
            "modified_start": query_result["modified_start"],
            "modified_end": query_result["modified_end"],
        }

        if scheduled_query.type == ScheduledQueryType.SERIES:
            extended_result["series"] = query_result
            return QueryResult(
                series_query=scheduled_query,
                totals_query=None,
                result=extended_result,
                has_more=has_more,
            )
        elif scheduled_query.type == ScheduledQueryType.TOTALS:
            extended_result["totals"] = query_result
            return QueryResult(
                series_query=None,
                totals_query=scheduled_query,
                result=extended_result,
                has_more=has_more,
            )

        raise MetricsQueryExecutionError(
            f"Can't build query result from query type {scheduled_query.type}"
        )

    def _any_query(self) -> ScheduledQuery:
        return cast(ScheduledQuery, self.series_query or self.totals_query)

    def merge(self, other: "QueryResult") -> "QueryResult":
        """
        Merges two QueryResult(s) into a single QueryResult by arbitrarily taking attributes of either of them.

        Returns:
            A QueryResult which contains the data of both QueryResult(s).
        """
        return QueryResult(
            series_query=self.series_query or other.series_query,
            totals_query=self.totals_query or other.totals_query,
            # We merge the dictionaries and in case of duplicated keys, the ones from `other` will be used, as per
            # Python semantics.
            result={**self.result, **other.result},
            has_more=self.has_more or other.has_more,
        )

    @property
    def modified_start(self) -> datetime:
        return self.result["modified_start"]

    @property
    def modified_end(self) -> datetime:
        return self.result["modified_end"]

    @property
    def series(self) -> Sequence[Mapping[str, Any]]:
        if "series" not in self.result:
            return []
        return self.result["series"]["data"]

    @series.setter
    def series(self, value: Sequence[Mapping[str, Any]]) -> None:
        self.result["series"]["data"] = value

    @property
    def totals(self) -> Sequence[Mapping[str, Any]]:
        if "totals" not in self.result:
            return []
        return self.result["totals"]["data"]

    @totals.setter
    def totals(self, value: Sequence[Mapping[str, Any]]) -> None:
        self.result["totals"]["data"] = value

    @property
    def meta(self) -> Sequence[Mapping[str, str]]:
        # By default, we extract the metadata from the totals query, if that is not there we extract from the series
        # query.
        meta_source = "totals" if "totals" in self.result else "series"
        return self.result[meta_source]["meta"]

    @property
    def group_bys(self) -> list[str]:
        # We return the groups directly from the query and not the actual groups returned by the query. This is done so
        # that we can correctly render groups in case they are not returned from the db because of missing data.
        #
        # Sorting of the groups is done to maintain consistency across function calls.
        scheduled_query = self._any_query()
        mappers = [mapper for mapper in scheduled_query.mappers if mapper.applied_on_groupby]
        return sorted(
            UsedGroupBysVisitor(mappers=mappers).visit(scheduled_query.metrics_query.query)
        )

    @property
    def interval(self) -> int | None:
        if self.series_query:
            return self.series_query.metrics_query.rollup.interval

        return None

    @property
    def order(self) -> Direction | None:
        if self.totals_query:
            return self.totals_query.metrics_query.rollup.orderby

        return None

    @property
    def limit(self) -> int | None:
        # The totals limit is the only one that controls the number of groups that are returned.
        # TODO: we might want to return the limit that is actually returned to users. In that, we would need to check
        #  if the queries run have a dynamic interval, since in that case we might need to return limit - 1.
        if self.totals_query:
            return self.totals_query.metrics_query.limit.limit

        return None

    @property
    def unit_family(self) -> UnitFamily | None:
        return self._any_query().unit_family

    @property
    def unit(self) -> MeasurementUnit | None:
        return self._any_query().unit

    @property
    def scaling_factor(self) -> float | None:
        return self._any_query().scaling_factor

    def align_series_to_totals(self, organization: Organization) -> "QueryResult":
        """
        Aligns the series to the totals of the same query.

        The alignment process just tries to place values belonging to the same groups in the same order.

        Returns:
            A mutated QueryResult objects with the aligned series to totals.
        """
        alignment_keys = self.group_bys
        if not alignment_keys:
            return self

        indexed_series: dict[tuple[tuple[str, str], ...], list[int]] = {}
        for index, data in enumerate(self.series):
            composite_key = _build_composite_key_from_dict(data, alignment_keys)
            # Since serieses have also the time component, we store multiple indexes of multiple times for the same
            # group.
            indexed_series.setdefault(composite_key, []).append(index)

        aligned_series = []
        for data in self.totals:
            composite_key = _build_composite_key_from_dict(data, alignment_keys)
            indexes = indexed_series.get(composite_key)
            # It can happen that the groups in series are not matching the groups in totals, due to Snuba bugs or just
            # limiting taking place in queries. Since this is a problem, we want to keep track of it.
            if indexes is None:
                with sentry_sdk.isolation_scope() as scope:
                    scope.set_tag("organization_id", organization.id)
                    scope.set_extra("totals_query", self.totals_query)
                    scope.set_extra("series_query", self.series_query)
                    sentry_sdk.capture_message(
                        "The series groups are not matching the totals groups"
                    )

            for index in indexes or ():
                aligned_series.append(self.series[index])

        # For the sake of simplicity we are mutating the original data.
        if aligned_series:
            self.result["series"]["data"] = aligned_series

        return self


@dataclass
class PartialQueryResult:
    """
    Represents a partial query result which contains all the queries that are linearly dependent and their results.

    This result is stored in the array of results for each ScheduledQuery that has a next parameter.

    Attributes:
        previous_queries: All the previous queries that have been executed as part of a single list of chained queries,
            defined via the next parameter of ScheduledQuery.
    """

    previous_queries: list[tuple[ScheduledQuery, Mapping[str, Any], bool]]

    def to_query_result(self) -> QueryResult:
        """
        Transforms a PartialQueryResult in a QueryResult by taking the last query that was executed in the list.

        Returns:
            A QueryResult which contains the data of the last query executed as part of this PartialQueryResult.
        """
        # For now, we naively return the first scheduled query and result, but this is just because
        # we currently support only the chaining of at most two queries, meaning that a partial result
        # can accumulate only one query.
        last_scheduled_query, last_query_result, has_more = self.previous_queries[0]
        return QueryResult.from_scheduled_query(
            scheduled_query=last_scheduled_query, query_result=last_query_result, has_more=has_more
        )


class QueryExecutor:
    """
    Represents an executor that is responsible for scheduling execution of the supplied ScheduledQuery(s).
    """

    def __init__(self, organization: Organization, projects: Sequence[Project], referrer: str):
        self._organization = organization
        self._projects = projects
        self._referrer = referrer

        # List of queries scheduled for execution which will change based on the progress that the execution has.
        self._scheduled_queries: list[ScheduledQuery | None] = []
        # List of query results that will be populated during query execution.
        self._query_results: list[PartialQueryResult | QueryResult | None] = []

        # Tracks the number of queries that have been executed (for measuring purposes).
        self._number_of_executed_queries = 0

    def _build_request(self, query: MetricsQuery) -> Request:
        """
        Builds a Snuba Request given a MetricsQuery to execute.

        Returns:
            A Snuba Request object which contains the query to execute.
        """
        return Request(
            # The dataset used here is arbitrary, since the `run_query` function will infer it internally.
            dataset=Dataset.Metrics.value,
            query=query,
            app_id="default",
            tenant_ids={"referrer": self._referrer, "organization_id": self._organization.id},
        )

    def _build_request_for_partial(
        self, query: MetricsQuery, partial_query_result: PartialQueryResult
    ) -> Request:
        """
        Builds a Snuba Request given a PartialQueryResult by applying the filters of the last query in the partial
        result to the MetricsQuery that we want to execute.

        Returns:
            A Snuba Request object which contains the transformed query to execute.
        """
        # We compute the groups that were returned by the query that was executed. We then inject those groups in each
        # `Timeseries` of the next query to execute. We do this in order to have at least the same groups returned by
        # the next query.
        #
        # Note that the mutation we do is not reflected in the queries that are returned as part of the
        # `QueryResult`(s) but since we do not need this data we can leave it out.
        _, last_query_result, _ = partial_query_result.previous_queries[0]
        next_metrics_query = _push_down_group_filters(
            query,
            # For now, we take the last result which will be the only one since we run at most two chained queries,
            # namely totals and series.
            _extract_groups_from_seq(last_query_result["data"]),
        )

        return self._build_request(next_metrics_query)

    def _bulk_run_query(self, requests: list[Request]) -> list[Mapping[str, Any]]:
        """
        Wraps the bulk_run_query method with some additional metrics and error handling.

        Returns:
            The results of the bulk_run_query method.
        """
        self._number_of_executed_queries += len(requests)

        try:
            with metrics.timer(key="ddm.metrics_api.execution.bulk_execution_time"):
                return bulk_run_query(requests)
        except SnubaError as e:
            sentry_sdk.capture_exception(e)
            metrics.incr(key="ddm.metrics_api.execution.error")
            raise MetricsQueryExecutionError("An error occurred while executing the query") from e

    def _bulk_execute(self) -> bool:
        """
        Executes all the scheduled queries in _scheduled_queries and merges the results into _query_results.

        This method must be called in a loop since it advances the execution one step at a time by parallelizing as much
        as possible all the queries that have to be executed and that have no sequential dependency defined via next.

        Returns:
            A boolean which is True when more queries can be executed or False otherwise.
        """
        # We create all the requests that can be run in bulk, by checking the scheduled queries that we can run.
        bulk_requests = []
        mappings = []
        for query_index, scheduled_query in enumerate(self._scheduled_queries):
            if scheduled_query is None:
                continue

            previous_result = self._query_results[query_index]
            metrics_query = scheduled_query.metrics_query
            if previous_result is None:
                bulk_requests.append(self._build_request(metrics_query))
            elif isinstance(previous_result, PartialQueryResult):
                bulk_requests.append(
                    self._build_request_for_partial(metrics_query, previous_result)
                )

            mappings.append(query_index)

        # If we have no more requests to run, we can stop the execution.
        if not bulk_requests:
            return False

        # We execute all the requests in bulk and for each result we decide what to do based on the next query and the
        # previous result in the `_query_results` array.
        bulk_results = self._bulk_run_query(bulk_requests)
        for query_index, query_result in zip(mappings, bulk_results):
            query_result = cast(dict[str, Any], query_result)
            scheduled_query = self._scheduled_queries[query_index]
            if scheduled_query is None:
                continue

            # If the query is a totals query and has dynamic limit, we want to check if we were able to load more groups
            # or not.
            has_more = False
            if scheduled_query.type == ScheduledQueryType.TOTALS and scheduled_query.dynamic_limit:
                data = query_result["data"]
                limit = scheduled_query.metrics_query.limit.limit

                # We take only the first n - 1 elements, since we have 1 element more of lookahead which is used to
                # determine if there are more groups.
                query_result["data"] = data[: limit - 1]
                has_more = len(data) >= limit

            previous_result = self._query_results[query_index]
            if scheduled_query.next is None:
                if previous_result is None:
                    self._query_results[query_index] = QueryResult.from_scheduled_query(
                        scheduled_query, query_result, has_more
                    )
                elif isinstance(previous_result, PartialQueryResult):
                    first_result = previous_result.to_query_result()
                    second_result = QueryResult.from_scheduled_query(
                        scheduled_query, query_result, has_more
                    )
                    merged_result = first_result.merge(second_result)
                    merged_result.align_series_to_totals(self._organization)
                    self._query_results[query_index] = merged_result
            else:
                current_query = (scheduled_query, query_result, has_more)
                if previous_result is None:
                    self._query_results[query_index] = PartialQueryResult(
                        previous_queries=[current_query],
                    )
                elif isinstance(previous_result, PartialQueryResult):
                    previous_result.previous_queries.append(current_query)

            # We bump the next query after the results have been merged, so that the next call to the function will
            # execute the next queries in the chain.
            self._scheduled_queries[query_index] = scheduled_query.next

        return True

    def _execution_loop(self):
        """
        Executes the next batch of queries until no query is left.
        """
        continue_execution = True
        while continue_execution:
            continue_execution = self._bulk_execute()

    def execute(self) -> list[QueryResult]:
        """
        Executes the scheduled queries in the execution loop.

        Returns:
            The results of the scheduled queries.
        """
        if not self._scheduled_queries:
            return []

        with metrics.timer(key="ddm.metrics_api.execution.total_execution_time"):
            self._execution_loop()

        metrics.distribution(
            key="ddm.metrics_api.execution.number_of_executed_queries",
            value=self._number_of_executed_queries,
        )

        for query_result in self._query_results:
            if not isinstance(query_result, QueryResult):
                raise MetricsQueryExecutionError(
                    "Not all queries were executed in the execution loop"
                )

        return cast(list[QueryResult], self._query_results)

    def schedule(self, intermediate_query: IntermediateQuery, query_type: QueryType):
        """
        Lazily schedules an IntermediateQuery for execution and runs initialization code for each ScheduledQuery.
        """
        # By default, we always want to have a totals query.
        totals_query = ScheduledQuery(
            type=ScheduledQueryType.TOTALS,
            metrics_query=intermediate_query.metrics_query,
            order=intermediate_query.order,
            limit=intermediate_query.limit,
            unit_family=intermediate_query.unit_family,
            unit=intermediate_query.unit,
            scaling_factor=intermediate_query.scaling_factor,
            mappers=intermediate_query.mappers,
        )

        # In case the user chooses to run also a series query, we will duplicate the query and chain it after totals.
        series_query = None
        if query_type == QueryType.TOTALS_AND_SERIES:
            series_query = replace(totals_query, type=ScheduledQueryType.SERIES)

        # We initialize the query by performing type-aware mutations that prepare the query to be executed correctly
        # (e.g., adding `totals` to a totals query...).
        final_query = replace(totals_query, next=series_query).initialize(
            self._organization, self._projects
        )

        self._scheduled_queries.append(final_query)
        self._query_results.append(None)
