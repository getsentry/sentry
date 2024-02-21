from collections.abc import Mapping, Sequence
from dataclasses import dataclass, replace
from datetime import datetime
from enum import Enum
from typing import Any, Union, cast

import sentry_sdk
from snuba_sdk import Column, Direction, MetricsQuery, MetricsScope, Request
from snuba_sdk.conditions import BooleanCondition, BooleanOp, Condition, Op

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.common import DEFAULT_QUERY_INTERVALS, SNUBA_QUERY_LIMIT
from sentry.sentry_metrics.querying.data_v2.plan import QueryOrder
from sentry.sentry_metrics.querying.errors import MetricsQueryExecutionError
from sentry.sentry_metrics.querying.types import GroupKey, GroupsCollection
from sentry.sentry_metrics.querying.visitors import (
    QueriedMetricsVisitor,
    TimeseriesConditionInjectionVisitor,
    UsedGroupBysVisitor,
)
from sentry.sentry_metrics.visibility import get_metrics_blocking_state
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics import to_intervals
from sentry.snuba.metrics_layer.query import bulk_run_query
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


def _push_down_group_filters(
    metrics_query: MetricsQuery, groups_collection: GroupsCollection | None
) -> MetricsQuery:
    """
    Returns a new `MetricsQuery` with a series of filters that ensure that the new query will have the same
    groups returned. Keep in mind that there is no guarantee that all the groups will be returned, since data might
    change in the meanwhile, so the guarantee of this method is that the returned groups will all be belonging to
    `groups_collection`.

    The need for this filter arises because when executing multiple queries, we want to have the same groups
    returned, in order to make results consistent. Note that in case queries have different groups, some results
    might be missing, since the reference query dictates which values are returned during the alignment process.
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
    SERIES = 0
    TOTALS = 1


@dataclass(frozen=True)
class ScheduledQuery:
    type: ScheduledQueryType
    metrics_query: MetricsQuery
    next: Union["ScheduledQuery", None] = None
    order: QueryOrder | None = None
    limit: int | None = None

    def initialize(
        self,
        organization: Organization,
        projects: Sequence[Project],
        blocked_metrics_for_projects: Mapping[str, set[int]],
    ) -> "ScheduledQuery":
        updated_metrics_query = self.metrics_query

        # We filter out all the projects for which the queried metrics are blocked.
        updated_metrics_query = self._filter_blocked_projects(
            updated_metrics_query, organization, projects, blocked_metrics_for_projects
        )
        # We align the date range of the query, considering the supplied interval.
        updated_metrics_query = self._align_date_range(updated_metrics_query)

        # We perform type-specific initializations, since based on the type we want to run
        # a different query.
        if self.type == ScheduledQueryType.SERIES:
            updated_metrics_query = self._initialize_series(updated_metrics_query)
        elif self.type == ScheduledQueryType.TOTALS:
            updated_metrics_query = self._initialize_totals(updated_metrics_query)

        # We recursively apply the initialization transformations downstream.
        updated_next = None
        if self.next is not None:
            updated_next = self.next.initialize(
                organization, projects, blocked_metrics_for_projects
            )

        return replace(self, metrics_query=updated_metrics_query, next=updated_next)

    def _initialize_series(self, metrics_query: MetricsQuery) -> MetricsQuery:
        updated_metrics_query = metrics_query

        # A series query runs always up to the maximum query limit.
        updated_metrics_query = updated_metrics_query.set_limit(SNUBA_QUERY_LIMIT)

        return updated_metrics_query

    def _initialize_totals(self, metrics_query: MetricsQuery) -> MetricsQuery:
        updated_metrics_query = metrics_query

        # A totals query doesn't have an interval.
        updated_metrics_query = updated_metrics_query.set_rollup(
            replace(updated_metrics_query.rollup, interval=None, totals=True)
        )

        if self.order:
            updated_metrics_query = updated_metrics_query.set_rollup(
                replace(updated_metrics_query.rollup, orderby=self.order.to_snuba_order())
            )

        if self.limit:
            updated_metrics_query = updated_metrics_query.set_limit(self.limit)
        else:
            updated_metrics_query = updated_metrics_query.set_limit(SNUBA_QUERY_LIMIT)

        return updated_metrics_query

    def is_empty(self) -> bool:
        return not self.metrics_query.scope.org_ids or not self.metrics_query.scope.project_ids

    @classmethod
    def _filter_blocked_projects(
        cls,
        metrics_query: MetricsQuery,
        organization: Organization,
        projects: Sequence[Project],
        blocked_metrics_for_projects: Mapping[str, set[int]],
    ) -> MetricsQuery:
        intersected_projects: set[int] = {project.id for project in projects}

        for queried_metric in QueriedMetricsVisitor().visit(metrics_query.query):
            blocked_for_projects = blocked_metrics_for_projects.get(queried_metric)
            if blocked_for_projects:
                metrics.incr(key="ddm.metrics_api.blocked_metric_queried", amount=1)
                intersected_projects -= blocked_for_projects

        return metrics_query.set_scope(
            MetricsScope(
                org_ids=[organization.id],
                project_ids=list(intersected_projects),
            )
        )

    @classmethod
    def _align_date_range(cls, metrics_query: MetricsQuery) -> MetricsQuery:
        # We use as a reference the interval supplied via the initial version of the query.
        interval = metrics_query.rollup.interval
        if interval:
            modified_start, modified_end, _ = to_intervals(
                metrics_query.start,
                metrics_query.end,
                interval,
            )
            if modified_start and modified_end:
                return metrics_query.set_start(modified_start).set_end(modified_end)

        return metrics_query


@dataclass(frozen=True)
class QueryResult:
    series_executable_query: MetricsQuery | None
    totals_executable_query: MetricsQuery | None
    result: Mapping[str, Any]

    def __post_init__(self):
        assert self.series_executable_query or self.totals_executable_query

    @classmethod
    def empty_from(cls, scheduled_query: ScheduledQuery) -> "QueryResult":
        series_metrics_query = None
        totals_metrics_query = None

        if scheduled_query.next is not None:
            totals_metrics_query = scheduled_query.metrics_query
            series_metrics_query = scheduled_query.next.metrics_query
        else:
            if scheduled_query.type == ScheduledQueryType.SERIES:
                series_metrics_query = scheduled_query.metrics_query
            elif scheduled_query.type == ScheduledQueryType.TOTALS:
                totals_metrics_query = scheduled_query.metrics_query

        return QueryResult(
            series_executable_query=series_metrics_query,
            totals_executable_query=totals_metrics_query,
            result={
                "series": {"data": {}, "meta": {}},
                "totals": {"data": {}, "meta": {}},
                # We want to honor the date ranges of the supplied query.
                "modified_start": scheduled_query.metrics_query.start,
                "modified_end": scheduled_query.metrics_query.end,
            },
        )

    @classmethod
    def from_query_type(
        cls, query_type: ScheduledQueryType, query: MetricsQuery, query_result: Mapping[str, Any]
    ) -> "QueryResult":
        extended_result = {
            "modified_start": query_result["modified_start"],
            "modified_end": query_result["modified_end"],
        }

        if query_type == ScheduledQueryType.SERIES:
            extended_result["series"] = query_result
            return QueryResult(
                series_executable_query=query,
                totals_executable_query=None,
                result=extended_result,
            )
        elif query_type == ScheduledQueryType.TOTALS:
            extended_result["totals"] = query_result
            return QueryResult(
                series_executable_query=None,
                totals_executable_query=query,
                result=extended_result,
            )

        raise MetricsQueryExecutionError(f"Can't build query result from query type {query_type}")

    def merge(self, other: "QueryResult") -> "QueryResult":
        return QueryResult(
            series_executable_query=self.series_executable_query or other.series_executable_query,
            totals_executable_query=self.totals_executable_query or other.totals_executable_query,
            result={**self.result, **other.result},
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

        return self.series_executable_query.rollup.interval

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
    def group_bys(self) -> list[str]:
        # We return the groups directly from the query and not the actual groups returned by the query. This is done so
        # that we can correctly render groups in case they are not returned from the db because of missing data.
        #
        # Sorting of the groups is done to maintain consistency across function calls.
        if self.series_executable_query:
            return sorted(UsedGroupBysVisitor().visit(self.series_executable_query.query))

        if self.totals_executable_query:
            return sorted(UsedGroupBysVisitor().visit(self.totals_executable_query.query))

        return []

    @property
    def order(self) -> Direction | None:
        if self.totals_executable_query:
            return self.totals_executable_query.rollup.orderby

        return None

    @property
    def limit(self) -> int | None:
        # The totals limit is the only one that controls the number of groups that are returned.
        if self.totals_executable_query:
            return self.totals_executable_query.limit.limit

        return None

    @property
    def length(self) -> int:
        # We try to see how many series results we got, since that is the query which is likely to surpass the limit.
        if "series" in self.result:
            return len(self.series)

        # If we have no series, totals will give us a hint of the size of the dataset.
        if "totals" in self.result:
            return len(self.totals)

        return 0

    def align_series_to_totals(self) -> "QueryResult":
        """
        Aligns the series to the totals of the same query.

        Note that the alignment performs a mutation of the current object.
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
            for index in indexes or ():
                aligned_series.append(self.series[index])

        if aligned_series:
            self.result["series"]["data"] = aligned_series

        return self


@dataclass(frozen=True)
class PartialQueryResult:
    scheduled_query: ScheduledQuery
    executed_result: Mapping[str, Any]

    def to_query_result(self) -> QueryResult:
        return QueryResult.from_query_type(
            query_type=self.scheduled_query.type,
            query=self.scheduled_query.metrics_query,
            query_result=self.executed_result,
        )


class QueryExecutor:
    def __init__(self, organization: Organization, projects: Sequence[Project], referrer: str):
        self._organization = organization
        self._projects = projects
        self._referrer = referrer

        # Ordered list of the intervals that can be chosen by the executor. They are removed when tried, in order
        # to avoid an infinite recursion.
        self._interval_choices = sorted(DEFAULT_QUERY_INTERVALS)
        # List of queries scheduled for execution.
        self._scheduled_queries: list[ScheduledQuery] = []
        # Tracks the number of queries that have been executed (for measuring purposes).
        self._number_of_executed_queries = 0
        # Tracks the pending query results that have been run by the executor. The list will contain both the final
        # `QueryResult` objects and the partial `PartialQueryResult` objects that still have to be executed.
        self._pending_query_results: list[QueryResult | PartialQueryResult] = []

        # We load the blocked metrics for the supplied projects.
        self._blocked_metrics_for_projects = self._load_blocked_metrics_for_projects()

    def _load_blocked_metrics_for_projects(self) -> Mapping[str, set[int]]:
        """
        Load the blocked metrics for the supplied projects and stores them in the executor in an efficient way that
        speeds up the determining of the projects to exclude from the query.
        """
        blocked_metrics_for_projects: dict[str, set[int]] = {}

        for project_id, metrics_blocking_state in get_metrics_blocking_state(
            self._projects
        ).items():
            for metric_blocking in metrics_blocking_state.metrics.values():
                blocked_metrics_for_projects.setdefault(metric_blocking.metric_mri, set()).add(
                    project_id
                )

        return blocked_metrics_for_projects

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

    def _build_request_for_partial(self, partial_query_result: PartialQueryResult) -> Request:
        if partial_query_result.scheduled_query.type != ScheduledQueryType.TOTALS:
            raise MetricsQueryExecutionError(
                "A partial query result must have an initial query of type totals"
            )

        next_scheduled_query = partial_query_result.scheduled_query.next
        if next_scheduled_query is None:
            raise MetricsQueryExecutionError(
                "A partial query result must have a next query to be executed"
            )

        # We compute the groups that were returned by the query that was executed. We then inject those groups in each
        # `Timeseries` of the next query to execute. We do this in order to have at least the same groups returned by
        # the next query.
        #
        # Note that the mutation we do is not reflected in the queries that are returned as part of the
        # `QueryResult`(s) but since we do not need this data we can leave it out.
        next_metrics_query = _push_down_group_filters(
            next_scheduled_query.metrics_query,
            _extract_groups_from_seq(partial_query_result.executed_result["data"]),
        )

        return self._build_request(next_metrics_query)

    def _bulk_run_query(self, requests: list[Request]) -> list[Mapping[str, Any]]:
        try:
            return bulk_run_query(requests)
        except SnubaError as e:
            sentry_sdk.capture_exception(e)
            raise MetricsQueryExecutionError("An error occurred while executing the query") from e

    def _bulk_execute(self) -> Sequence[QueryResult]:
        # We build all the requests that can be scheduled together in the first step.
        bulk_requests = []
        # We collect all the indexes of the queries which are empty and should not be executed.
        empty_queries_indexes = []
        for query_index, scheduled_query in enumerate(self._scheduled_queries):
            if scheduled_query.is_empty():
                empty_queries_indexes.append(query_index)
            else:
                bulk_requests.append(self._build_request(scheduled_query.metrics_query))

        # We run the requests in bulk and obtain a list of pending query results, which can include both
        # `QueryResult`(s) that are done and `PartialQueryResult`(s) which require a second pass.
        query_results = self._bulk_run_query(bulk_requests)
        # We inject into the results all the empty values belonging to the empty queries. This insertion assumes that
        # we do the filling of `query_results` in order, otherwise it won't work.
        for empty_query_index in empty_queries_indexes:
            query_results.insert(empty_query_index, {})

        for query_index, query_result in enumerate(query_results):
            scheduled_query = self._scheduled_queries[query_index]
            if scheduled_query.is_empty():
                self._pending_query_results.append(
                    QueryResult.empty_from(scheduled_query=scheduled_query)
                )
            elif scheduled_query.next is not None:
                self._pending_query_results.append(
                    PartialQueryResult(
                        scheduled_query=scheduled_query,
                        executed_result=query_result,
                    )
                )
            else:
                self._pending_query_results.append(
                    QueryResult.from_query_type(
                        query_type=scheduled_query.type,
                        query=scheduled_query.metrics_query,
                        query_result=query_result,
                    )
                )

        # We build all the requests for the `PendingQueryResult`(s) which will again be executed in parallel.
        bulk_requests = []
        mappings = []
        for query_index, pending_query_result in enumerate(self._pending_query_results):
            if isinstance(pending_query_result, PartialQueryResult):
                bulk_requests.append(self._build_request_for_partial(pending_query_result))
                mappings.append(query_index)

        # We run the requests in bulk to obtain a list of `QueryResult`(s). In order to do so, the `QueryResult` objects
        # from the first and second query are merged.
        query_results = self._bulk_run_query(bulk_requests)
        for query_index, query_result in zip(mappings, query_results):
            partial_query_result = self._pending_query_results[query_index]
            if isinstance(partial_query_result, PartialQueryResult):
                next_scheduled_query = partial_query_result.scheduled_query.next
                # If, for some reason, there is a `None` next at this point, we will just dump the partial query as a
                # `QueryResult`.
                if next_scheduled_query is None:
                    self._pending_query_results[
                        query_index
                    ] = partial_query_result.to_query_result()
                    continue

                # If there is a next query, we will merge the first and second queries into a single `QueryResult`.
                first_query_result = partial_query_result.to_query_result()
                second_query_result = QueryResult.from_query_type(
                    query_type=next_scheduled_query.type,
                    query=next_scheduled_query.metrics_query,
                    query_result=query_result,
                )
                self._pending_query_results[query_index] = first_query_result.merge(
                    second_query_result
                )

        # For now, we naively cast to a list of `QueryResult` since we assume that the chaining is used with at most
        # a depth of 2 (e.g., query_1 -> query_2), so by this point we should NOT have anymore `PartialQueryResult`(s)
        # left.
        return cast(Sequence[QueryResult], self._pending_query_results)

    def execute(self) -> Sequence[QueryResult]:
        """
        Executes the scheduled queries serially.
        """
        if not self._scheduled_queries:
            return []

        return self._bulk_execute()

    def schedule(
        self,
        query: MetricsQuery,
        order: QueryOrder | None,
        limit: int | None,
    ):
        """
        Lazily schedules a query for execution.

        Note that this method won't execute the query, since it's lazy in nature.
        """
        # For now, we are always building a (totals -> series) query, but the execution engine is fully capable of
        # supporting either a single totals or series query.
        executable_query = ScheduledQuery(
            type=ScheduledQueryType.TOTALS,
            metrics_query=query,
            next=ScheduledQuery(
                type=ScheduledQueryType.SERIES,
                metrics_query=query,
                order=order,
                limit=limit,
            ),
            order=order,
            limit=limit,
        )
        # We initialize the query by performing type-aware mutations that prepare the query to be executed correctly
        # (e.g., adding `totals` to a totals query...).
        executable_query = executable_query.initialize(
            self._organization, self._projects, self._blocked_metrics_for_projects
        )
        self._scheduled_queries.append(executable_query)
