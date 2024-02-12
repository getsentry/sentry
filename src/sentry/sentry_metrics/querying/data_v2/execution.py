from collections.abc import Mapping, Sequence
from dataclasses import dataclass, replace
from datetime import datetime
from typing import Any

import sentry_sdk
from snuba_sdk import Column, Direction, MetricsQuery, MetricsScope, Request
from snuba_sdk.conditions import BooleanCondition, BooleanOp, Condition, Op

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.sentry_metrics.querying.common import DEFAULT_QUERY_INTERVALS, SNUBA_QUERY_LIMIT
from sentry.sentry_metrics.querying.data_v2.plan import QueryOrder
from sentry.sentry_metrics.querying.errors import (
    InvalidMetricsQueryError,
    MetricsQueryExecutionError,
)
from sentry.sentry_metrics.querying.types import GroupKey, GroupsCollection
from sentry.sentry_metrics.querying.visitors import (
    QueriedMetricsVisitor,
    TimeseriesConditionInjectionVisitor,
    UsedGroupBysVisitor,
)
from sentry.sentry_metrics.visibility import get_metrics_blocking_state
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


@dataclass(frozen=True)
class ExecutableQuery:
    with_series: bool
    with_totals: bool

    identifier: str
    metrics_query: MetricsQuery
    order: QueryOrder | None
    limit: int | None

    def is_empty(self) -> bool:
        return not self.metrics_query.scope.org_ids or not self.metrics_query.scope.project_ids

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
        groups_collection: GroupsCollection | None,
    ) -> "ExecutableQuery":
        """
        Returns a new `ExecutableQuery` with a series of filters that ensure that the new query will have the same
        groups returned. Keep in mind that there is no guarantee that all the groups will be returned, since data might
        change in the meanwhile, so the guarantee of this method is that the returned groups will all be belonging to
        `groups_collection`.

        The need for this filter arises because when executing multiple queries, we want to have the same groups
        returned, in order to make results consistent. Note that in case queries have different groups, some results
        might be missing, since the reference query dictates which values are returned during the alignment process.
        """
        if not groups_collection:
            return self

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

        merged_query = TimeseriesConditionInjectionVisitor(groups_filters).visit(
            self.metrics_query.query
        )
        return replace(
            self,
            metrics_query=self.metrics_query.set_query(merged_query),
        )

    def filter_blocked_projects(
        self,
        organization: Organization,
        projects: set[Project],
        blocked_metrics_for_projects: Mapping[str, set[int]],
    ) -> "ExecutableQuery":
        """
        Returns a new `ExecutableQuery` with the projects for which all the queries are not blocked. In case no projects
        exist, the query will be returned with empty projects, signaling the executor to not run the query.
        """
        intersected_projects: set[int] = {project.id for project in projects}

        for queried_metric in QueriedMetricsVisitor().visit(self.metrics_query.query):
            blocked_for_projects = blocked_metrics_for_projects.get(queried_metric)
            if blocked_for_projects:
                metrics.incr(key="ddm.metrics_api.blocked_metric_queried", amount=1)
                intersected_projects -= blocked_for_projects

        return replace(
            self,
            metrics_query=self.metrics_query.set_scope(
                MetricsScope(
                    org_ids=[organization.id],
                    project_ids=list(intersected_projects),
                )
            ),
        )


@dataclass(frozen=True)
class QueryResult:
    series_executable_query: ExecutableQuery | None
    totals_executable_query: ExecutableQuery | None
    result: Mapping[str, Any]

    def __post_init__(self):
        assert self.series_executable_query or self.totals_executable_query

    @classmethod
    def empty_from(cls, executable_query: ExecutableQuery) -> "QueryResult":
        return QueryResult(
            series_executable_query=executable_query,
            totals_executable_query=executable_query,
            result={
                "series": {"data": {}, "meta": {}},
                "totals": {"data": {}, "meta": {}},
                # We want to honor the date ranges of the supplied query.
                "modified_start": executable_query.metrics_query.start,
                "modified_end": executable_query.metrics_query.end,
            },
        )

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
    def group_bys(self) -> list[str]:
        # We return the groups directly from the query and not the actual groups returned by the query. This is done so
        # that we can correctly render groups in case they are not returned from the db because of missing data.
        #
        # Sorting of the groups is done to maintain consistency across function calls.
        if self.series_executable_query:
            return sorted(
                UsedGroupBysVisitor().visit(self.series_executable_query.metrics_query.query)
            )

        if self.totals_executable_query:
            return sorted(
                UsedGroupBysVisitor().visit(self.totals_executable_query.metrics_query.query)
            )

        return []

    @property
    def order(self) -> str | None:
        if self.series_executable_query and self.series_executable_query.order is not None:
            return self.series_executable_query.order.value

        if self.totals_executable_query and self.totals_executable_query.order is not None:
            return self.totals_executable_query.order.value

        return None

    @property
    def limit(self) -> int | None:
        if self.series_executable_query:
            return self.series_executable_query.limit

        if self.totals_executable_query:
            return self.totals_executable_query.limit

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


class QueryExecutor:
    def __init__(self, organization: Organization, projects: Sequence[Project], referrer: str):
        self._organization = organization
        self._projects = projects
        self._referrer = referrer

        # Ordered list of the intervals that can be chosen by the executor. They are removed when tried, in order
        # to avoid an infinite recursion.
        self._interval_choices = sorted(DEFAULT_QUERY_INTERVALS)
        # List of queries scheduled for execution.
        self._scheduled_queries: list[ExecutableQuery] = []
        # Tracks the number of queries that have been executed (for measuring purposes).
        self._number_of_executed_queries = 0

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

    def _execute(self, executable_query: ExecutableQuery) -> QueryResult:
        """
        Executes a query as series and/or totals and returns the result.
        """
        try:
            # We merge the query with the blocked projects, in order to obtain a new query with only the projects that
            # all have the queried metrics unblocked.
            executable_query = executable_query.filter_blocked_projects(
                organization=self._organization,
                projects=set(self._projects),
                blocked_metrics_for_projects=self._blocked_metrics_for_projects,
            )

            # We try to determine the interval of the query, which will be used to define clear time bounds for both
            # queries. This is done here since the metrics layer doesn't adjust the time for totals queries.
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

            # If, after merging the query with the blocked projects, the query becomes empty, we will return an empty
            # result.
            if executable_query.is_empty():
                return QueryResult.empty_from(executable_query)

            totals_executable_query = executable_query
            totals_result = None
            if executable_query.with_totals:
                # If there is an order by, we apply it only on the totals query. We can't order a series query, for this
                # reason we have to perform ordering here.
                if executable_query.order:
                    totals_executable_query = totals_executable_query.replace_order_by(
                        executable_query.order.to_snuba_order()
                    )

                # Only in totals, if there is a limit passed by the user, we will honor that and apply it.
                if executable_query.limit:
                    totals_executable_query = totals_executable_query.replace_limit(
                        executable_query.limit
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
                # For series queries, we always want to use the default Snuba limit.
                series_executable_query = series_executable_query.replace_limit(SNUBA_QUERY_LIMIT)

                # In order to have at least the same groups, we need to pass down the groups obtained in the
                # previous totals query to the series query.
                if totals_result:
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

    def _serial_execute(self) -> Sequence[QueryResult]:
        """
        Executes serially all the queries that are supplied to the QueryExecutor.

        The execution will try to satisfy the query by dynamically changing its interval, in the case in which the
        Snuba limit is reached.
        """
        results = []
        for query in self._scheduled_queries:
            with metrics.timer(key="ddm.metrics_api.metrics_query.execution_time"):
                query_result = self._execute(executable_query=query)
                results.append(query_result.align_series_to_totals())

        return results

    def execute(self, batch: bool = False) -> Sequence[QueryResult]:
        """
        Executes the scheduled queries serially.
        """
        # TODO: implement batch execution when there will be the support for it.
        results = self._serial_execute()
        metrics.distribution(
            key="ddm.metrics_api.queries_executed", value=self._number_of_executed_queries
        )

        return results

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
        executable_query = ExecutableQuery(
            with_series=True,
            with_totals=True,
            # We identify the query with its index.
            identifier=str(len(self._scheduled_queries)),
            metrics_query=query,
            order=order,
            limit=limit,
        )
        self._scheduled_queries.append(executable_query)
