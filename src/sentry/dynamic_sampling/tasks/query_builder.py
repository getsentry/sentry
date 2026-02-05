from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Generic, TypedDict, TypeVar

from snuba_sdk import (
    AliasedExpression,
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Granularity,
    LimitBy,
    Op,
    OrderBy,
    Query,
    Request,
)

from sentry.dynamic_sampling.tasks.constants import CHUNK_SIZE
from sentry.dynamic_sampling.types import SamplingMeasure
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import SpanMRI, TransactionMRI
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query

# Type variables for generic fetcher base classes
CacheItemT = TypeVar("CacheItemT")

# Default time intervals for convenience functions
DEFAULT_TIME_INTERVAL_5_MIN = timedelta(minutes=5)
DEFAULT_TIME_INTERVAL_1_HOUR = timedelta(hours=1)
ReturnT = TypeVar("ReturnT")


class BaseBatchFetcher(ABC, Generic[CacheItemT, ReturnT]):
    """
    Base class for fetchers that return batches of results.

    This provides common caching and iteration logic for fetchers like
    GetActiveOrgs and GetActiveOrgsVolumes that accumulate results and
    return them in batches.

    Subclasses must implement:
    - _create_query_iterator(): Create the query iterator
    - _transform_result(result): Transform a QueryResult into a cache item
    - _enough_results_cached(): Check if we have enough results for a batch
    - _extract_batch(): Extract and return a batch from the cache
    """

    def __init__(self) -> None:
        self._cache: list[CacheItemT] = []
        self._exhausted = False
        self._query_iterator: Iterator[list[QueryResult]] | None = None

    def _initialize_query(self) -> None:
        """Initialize the query iterator. Call this at the end of subclass __init__."""
        self._query_iterator = self._create_query_iterator()

    @abstractmethod
    def _create_query_iterator(self) -> Iterator[list[QueryResult]]:
        """Create and return the query iterator."""
        ...

    @abstractmethod
    def _transform_result(self, result: QueryResult) -> CacheItemT:
        """Transform a QueryResult into a cache item."""
        ...

    @abstractmethod
    def _enough_results_cached(self) -> bool:
        """Return True if we have enough results cached to return a batch."""
        ...

    @abstractmethod
    def _extract_batch(self) -> ReturnT:
        """Extract and return a batch from the cache."""
        ...

    def __iter__(self) -> BaseBatchFetcher[CacheItemT, ReturnT]:
        return self

    def __next__(self) -> ReturnT:
        if self._enough_results_cached():
            return self._extract_batch()

        if not self._exhausted:
            self._fetch_more()

        if self._cache:
            return self._extract_batch()
        else:
            raise StopIteration()

    def _fetch_more(self) -> None:
        """Fetch more results from the query."""
        if self._query_iterator is None:
            self._exhausted = True
            return

        try:
            batch = next(self._query_iterator)
            for result in batch:
                self._cache.append(self._transform_result(result))
        except StopIteration:
            self._exhausted = True


class BaseItemFetcher(ABC, Generic[CacheItemT]):
    """
    Base class for fetchers that return individual items.

    This provides common caching and iteration logic for fetchers like
    FetchProjectTransactionTotals that return one item at a time.

    Subclasses must implement:
    - _create_query_iterator(): Create the query iterator
    - _process_batch(batch): Process a batch of results and add to cache
    """

    def __init__(self) -> None:
        self._cache: list[CacheItemT] = []
        self._exhausted = False
        self._query_iterator: Iterator[list[QueryResult]] | None = None

    def _initialize_query(self) -> None:
        """Initialize the query iterator. Call this at the end of subclass __init__."""
        self._query_iterator = self._create_query_iterator()

    @abstractmethod
    def _create_query_iterator(self) -> Iterator[list[QueryResult]] | None:
        """Create and return the query iterator. Can return None if no query needed."""
        ...

    @abstractmethod
    def _process_batch(self, batch: list[QueryResult]) -> None:
        """Process a batch of results and add items to self._cache."""
        ...

    def __iter__(self) -> BaseItemFetcher[CacheItemT]:
        return self

    def __next__(self) -> CacheItemT:
        if self._exhausted and self._cache_empty():
            raise StopIteration()

        if not self._cache_empty():
            return self._get_from_cache()

        if not self._exhausted:
            self._fetch_more()

        return self._get_from_cache()

    def _fetch_more(self) -> None:
        """Fetch more results from the query."""
        if self._query_iterator is None:
            self._exhausted = True
            return

        try:
            batch = next(self._query_iterator)
            self._process_batch(batch)
        except StopIteration:
            self._exhausted = True

    def _cache_empty(self) -> bool:
        """Return True if the cache is empty."""
        return not self._cache

    def _get_from_cache(self) -> CacheItemT:
        """Get and remove the first item from the cache."""
        if self._cache_empty():
            raise StopIteration()
        return self._cache.pop(0)


class MeasureConfig(TypedDict):
    """Configuration for a sampling measure query."""

    mri: str
    use_case_id: UseCaseID
    tags: dict[str, str]


# Configuration for each sampling measure type
MEASURE_CONFIGS: dict[SamplingMeasure, MeasureConfig] = {
    # SEGMENTS: SpanMRI with is_segment=true filter (replacement for transactions)
    SamplingMeasure.SEGMENTS: {
        "mri": SpanMRI.COUNT_PER_ROOT_PROJECT.value,
        "use_case_id": UseCaseID.SPANS,
        "tags": {"is_segment": "true"},
    },
    # SPANS: SpanMRI without is_segment filter (AM3/project mode - counts all spans)
    SamplingMeasure.SPANS: {
        "mri": SpanMRI.COUNT_PER_ROOT_PROJECT.value,
        "use_case_id": UseCaseID.SPANS,
        "tags": {},
    },
    # TRANSACTIONS: TransactionMRI without tag filters (legacy)
    SamplingMeasure.TRANSACTIONS: {
        "mri": TransactionMRI.COUNT_PER_ROOT_PROJECT.value,
        "use_case_id": UseCaseID.TRANSACTIONS,
        "tags": {},
    },
}


class GroupBy(Enum):
    """Grouping level for dynamic sampling queries."""

    ORG = "org"
    PROJECT = "project"
    TRANSACTION = "transaction"


@dataclass
class QueryResult:
    """A single row result from a dynamic sampling query."""

    org_id: int
    project_id: int | None = None
    transaction_name: str | None = None
    total: float = 0
    keep_count: float | None = None
    drop_count: float | None = None
    project_count: int | None = None
    class_count: int | None = None


@dataclass
class DynamicSamplingMetricsQuery:
    """
    Centralized query builder for dynamic sampling metrics.

    This class provides a unified interface for querying dynamic sampling metrics
    with consistent patterns for:
    - Measure configuration (TRANSACTIONS, SEGMENTS, SPANS)
    - Time range filtering
    - Tag filters from measure config
    - Grouping (org, project, transaction level)
    - Aggregations (total, keep/drop counts, project/class counts)
    - Pagination

    Example usage:
        # Query org-level volumes with keep counts
        query = DynamicSamplingMetricsQuery(
            measure=SamplingMeasure.TRANSACTIONS,
            time_interval=timedelta(minutes=5),
            group_by=GroupBy.ORG,
            include_keep_count=True,
        )
        for batch in query.execute():
            for result in batch:
                print(f"Org {result.org_id}: {result.total} total, {result.keep_count} kept")

        # Query project-level volumes with keep/drop counts
        query = DynamicSamplingMetricsQuery(
            measure=SamplingMeasure.SEGMENTS,
            time_interval=timedelta(hours=1),
            group_by=GroupBy.PROJECT,
            org_ids=[1, 2, 3],
            include_keep_count=True,
            include_drop_count=True,
        )

        # Query transaction-level volumes
        query = DynamicSamplingMetricsQuery(
            measure=SamplingMeasure.TRANSACTIONS,
            time_interval=timedelta(hours=1),
            group_by=GroupBy.TRANSACTION,
            org_ids=[1, 2, 3],
            transaction_limit_per_project=10,
            transaction_order=Direction.DESC,  # Top transactions
        )
    """

    # Required parameters
    measure: SamplingMeasure
    time_interval: timedelta
    group_by: GroupBy

    # Granularity for the query (defaults based on time_interval)
    granularity: Granularity | None = None

    # Filters
    org_ids: list[int] | None = None
    project_ids: list[int] | None = None

    # Aggregations to include
    include_keep_count: bool = False
    include_drop_count: bool = False
    include_project_count: bool = False
    include_class_count: bool = False

    # Transaction-specific options (only used when group_by=TRANSACTION)
    transaction_limit_per_project: int | None = None
    transaction_order: Direction = Direction.DESC

    # Pagination
    chunk_size: int = CHUNK_SIZE

    # Referrer for the query
    referrer: Referrer = (
        Referrer.DYNAMIC_SAMPLING_COUNTERS_FETCH_PROJECTS_WITH_COUNT_PER_TRANSACTION
    )

    # Internal state
    _offset: int = field(default=0, init=False, repr=False)
    _has_more: bool = field(default=True, init=False, repr=False)
    _config: MeasureConfig | None = field(default=None, init=False, repr=False)
    _metric_id: int | None = field(default=None, init=False, repr=False)

    def __post_init__(self) -> None:
        self._config = MEASURE_CONFIGS[self.measure]
        self._metric_id = indexer.resolve_shared_org(str(self._config["mri"]))

        # Set default granularity based on time interval
        if self.granularity is None:
            if self.time_interval > timedelta(days=1):
                self.granularity = Granularity(24 * 3600)
            elif self.time_interval > timedelta(hours=1):
                self.granularity = Granularity(3600)
            else:
                self.granularity = Granularity(60)

    def execute(self) -> Iterator[list[QueryResult]]:
        """Execute the query and yield batches of results."""
        self._offset = 0
        self._has_more = True

        while self._has_more:
            batch = self._fetch_batch()
            if batch:
                yield batch
            if not self._has_more:
                break

    def _fetch_batch(self) -> list[QueryResult]:
        """Fetch a single batch of results from the database."""
        query = self._build_query()

        request = Request(
            dataset=Dataset.PerformanceMetrics.value,
            app_id="dynamic_sampling",
            query=query.set_offset(self._offset),
            tenant_ids={
                "use_case_id": self._config["use_case_id"].value,
                "cross_org_query": 1,
            },
        )

        data = raw_snql_query(request, referrer=self.referrer.value)["data"]

        # Check if there are more results
        self._has_more = len(data) > self.chunk_size
        self._offset += self.chunk_size

        # Trim the extra row we fetched to check for more results
        if self._has_more:
            data = data[:-1]

        return self._parse_results(data)

    def _build_query(self) -> Query:
        """Build the Snuba query."""
        query = Query(
            match=Entity(EntityKey.GenericOrgMetricsCounters.value),
            select=self._build_select(),
            groupby=self._build_groupby(),
            where=self._build_where(),
            orderby=self._build_orderby(),
            granularity=self.granularity,
        ).set_limit(self.chunk_size + 1)

        limitby = self._build_limitby()
        if limitby is not None:
            query = query.set_limitby(limitby)

        return query

    def _build_select(self) -> list[Column | Function | AliasedExpression]:
        """Build the SELECT clause."""
        select: list[Column | Function | AliasedExpression] = [
            Function("sum", [Column("value")], "total"),
            Column("org_id"),
        ]

        if self.group_by in (GroupBy.PROJECT, GroupBy.TRANSACTION):
            select.append(Column("project_id"))

        if self.group_by == GroupBy.TRANSACTION:
            transaction_string_id = indexer.resolve_shared_org("transaction")
            transaction_tag = f"tags_raw[{transaction_string_id}]"
            select.append(AliasedExpression(Column(transaction_tag), "transaction_name"))

        if self.include_keep_count or self.include_drop_count:
            decision_string_id = indexer.resolve_shared_org("decision")
            decision_tag = f"tags_raw[{decision_string_id}]"

            if self.include_keep_count:
                select.append(
                    Function(
                        "sumIf",
                        [
                            Column("value"),
                            Function("equals", [Column(decision_tag), "keep"]),
                        ],
                        alias="keep_count",
                    )
                )

            if self.include_drop_count:
                select.append(
                    Function(
                        "sumIf",
                        [
                            Column("value"),
                            Function("equals", [Column(decision_tag), "drop"]),
                        ],
                        alias="drop_count",
                    )
                )

        if self.include_project_count:
            select.append(Function("uniq", [Column("project_id")], "project_count"))

        if self.include_class_count:
            transaction_string_id = indexer.resolve_shared_org("transaction")
            transaction_tag = f"tags_raw[{transaction_string_id}]"
            select.append(Function("uniq", [Column(transaction_tag)], "class_count"))

        return select

    def _build_groupby(self) -> list[Column | AliasedExpression]:
        """Build the GROUP BY clause."""
        groupby: list[Column | AliasedExpression] = [Column("org_id")]

        if self.group_by in (GroupBy.PROJECT, GroupBy.TRANSACTION):
            groupby.append(Column("project_id"))

        if self.group_by == GroupBy.TRANSACTION:
            transaction_string_id = indexer.resolve_shared_org("transaction")
            transaction_tag = f"tags_raw[{transaction_string_id}]"
            groupby.append(AliasedExpression(Column(transaction_tag), "transaction_name"))

        return groupby

    def _build_where(self) -> list[Condition]:
        """Build the WHERE clause."""
        where: list[Condition] = [
            Condition(Column("timestamp"), Op.GTE, datetime.utcnow() - self.time_interval),
            Condition(Column("timestamp"), Op.LT, datetime.utcnow()),
            Condition(Column("metric_id"), Op.EQ, self._metric_id),
        ]

        # Add measure-specific tag filters
        for tag_name, tag_value in self._config["tags"].items():
            tag_string_id = indexer.resolve_shared_org(tag_name)
            tag_column = f"tags_raw[{tag_string_id}]"
            where.append(Condition(Column(tag_column), Op.EQ, tag_value))

        # Add org filter
        if self.org_ids:
            where.append(Condition(Column("org_id"), Op.IN, self.org_ids))

        # Add project filter
        if self.project_ids:
            where.append(Condition(Column("project_id"), Op.IN, self.project_ids))

        return where

    def _build_orderby(self) -> list[OrderBy]:
        """Build the ORDER BY clause."""
        orderby = [OrderBy(Column("org_id"), Direction.ASC)]

        if self.group_by in (GroupBy.PROJECT, GroupBy.TRANSACTION):
            orderby.append(OrderBy(Column("project_id"), Direction.ASC))

        if self.group_by == GroupBy.TRANSACTION:
            orderby.append(OrderBy(Column("total"), self.transaction_order))

        return orderby

    def _build_limitby(self) -> LimitBy | None:
        """Build the LIMIT BY clause for per-group limits."""
        if self.group_by == GroupBy.TRANSACTION and self.transaction_limit_per_project:
            return LimitBy(
                columns=[Column("org_id"), Column("project_id")],
                count=self.transaction_limit_per_project,
            )
        return None

    def _parse_results(self, data: list[dict[str, Any]]) -> list[QueryResult]:
        """Parse raw query results into QueryResult objects."""
        results = []
        for row in data:
            result = QueryResult(
                org_id=int(row["org_id"]),
                total=float(row["total"]),
            )

            if "project_id" in row:
                result.project_id = int(row["project_id"])

            if "transaction_name" in row:
                result.transaction_name = str(row["transaction_name"])

            if "keep_count" in row:
                result.keep_count = float(row["keep_count"])

            if "drop_count" in row:
                result.drop_count = float(row["drop_count"])

            if "project_count" in row:
                result.project_count = int(row["project_count"])

            if "class_count" in row:
                result.class_count = int(row["class_count"])

            results.append(result)

        return results


# Convenience functions for common query patterns


def query_org_volumes(
    measure: SamplingMeasure,
    time_interval: timedelta = DEFAULT_TIME_INTERVAL_5_MIN,
    org_ids: list[int] | None = None,
    include_keep_count: bool = True,
    granularity: Granularity | None = None,
) -> Iterator[list[QueryResult]]:
    """
    Query organization-level volumes.

    Used by: recalibrate_orgs, sliding_window_org
    """
    query = DynamicSamplingMetricsQuery(
        measure=measure,
        time_interval=time_interval,
        group_by=GroupBy.ORG,
        org_ids=org_ids,
        include_keep_count=include_keep_count,
        granularity=granularity,
        referrer=Referrer.DYNAMIC_SAMPLING_COUNTERS_GET_ORG_TRANSACTION_VOLUMES,
    )
    return query.execute()


def query_active_orgs(
    measure: SamplingMeasure,
    time_interval: timedelta = DEFAULT_TIME_INTERVAL_1_HOUR,
    granularity: Granularity | None = None,
) -> Iterator[list[QueryResult]]:
    """
    Query active organizations with project counts.

    Used by: boost_low_volume_transactions, boost_low_volume_projects
    """
    query = DynamicSamplingMetricsQuery(
        measure=measure,
        time_interval=time_interval,
        group_by=GroupBy.ORG,
        include_project_count=True,
        granularity=granularity,
        referrer=Referrer.DYNAMIC_SAMPLING_COUNTERS_FETCH_PROJECTS_WITH_COUNT_PER_TRANSACTION,
    )
    return query.execute()


def query_project_volumes(
    measure: SamplingMeasure,
    org_ids: list[int],
    time_interval: timedelta = DEFAULT_TIME_INTERVAL_1_HOUR,
    project_ids: list[int] | None = None,
    include_keep_count: bool = True,
    include_drop_count: bool = False,
    include_class_count: bool = False,
    granularity: Granularity | None = None,
) -> Iterator[list[QueryResult]]:
    """
    Query project-level volumes.

    Used by: boost_low_volume_projects, boost_low_volume_transactions
    """
    query = DynamicSamplingMetricsQuery(
        measure=measure,
        time_interval=time_interval,
        group_by=GroupBy.PROJECT,
        org_ids=org_ids,
        project_ids=project_ids,
        include_keep_count=include_keep_count,
        include_drop_count=include_drop_count,
        include_class_count=include_class_count,
        granularity=granularity,
        referrer=Referrer.DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_PROJECTS_WITH_COUNT_PER_ROOT,
    )
    return query.execute()


def query_transaction_volumes(
    measure: SamplingMeasure,
    org_ids: list[int],
    time_interval: timedelta = DEFAULT_TIME_INTERVAL_1_HOUR,
    limit_per_project: int = 10,
    order: Direction = Direction.DESC,
    granularity: Granularity | None = None,
) -> Iterator[list[QueryResult]]:
    """
    Query transaction-level volumes within projects.

    Used by: boost_low_volume_transactions
    """
    query = DynamicSamplingMetricsQuery(
        measure=measure,
        time_interval=time_interval,
        group_by=GroupBy.TRANSACTION,
        org_ids=org_ids,
        transaction_limit_per_project=limit_per_project,
        transaction_order=order,
        granularity=granularity,
        referrer=Referrer.DYNAMIC_SAMPLING_COUNTERS_FETCH_PROJECTS_WITH_COUNT_PER_TRANSACTION,
    )
    return query.execute()
