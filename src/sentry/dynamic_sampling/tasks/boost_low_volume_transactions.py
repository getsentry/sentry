from __future__ import annotations

from typing import TypedDict

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

from sentry.dynamic_sampling.tasks.common import MEASURE_CONFIGS
from sentry.dynamic_sampling.tasks.constants import (
    BOOST_LOW_VOLUME_TRANSACTIONS_QUERY_INTERVAL,
    CHUNK_SIZE,
)
from sentry.dynamic_sampling.types import SamplingMeasure
from sentry.sentry_metrics import indexer
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.referrer import Referrer
from sentry.utils import metrics
from sentry.utils.dates import deprecated_utcnow
from sentry.utils.snuba import raw_snql_query


class ProjectIdentity(TypedDict, total=True):
    """
    Project identity, used to match projects and also to
    order them
    """

    project_id: int
    org_id: int


class ProjectTransactions(ProjectIdentity, total=True):
    """
    Information about the project transactions
    """

    transaction_counts: list[tuple[str, float]]
    total_num_transactions: float | None
    total_num_classes: int | None


class FetchProjectTransactionVolumes:
    """
    Fetch the highest-volume transactions for all orgs and all projects with pagination
    orgs and projects with count per root project

    org_ids: the orgs for which the projects & transactions should be returned

    max_transactions: maximum number of transactions to return

    measure: which SamplingMeasure to use for querying metrics
    """

    def __init__(
        self,
        orgs: list[int],
        max_transactions: int,
        measure: SamplingMeasure = SamplingMeasure.SEGMENTS,
    ):
        self.max_transactions = max_transactions
        self.org_ids = orgs
        self.offset = 0
        transaction_string_id = indexer.resolve_shared_org("transaction")
        self.transaction_tag = f"tags_raw[{transaction_string_id}]"

        config = MEASURE_CONFIGS[measure]
        self.metric_id = indexer.resolve_shared_org(str(config["mri"]))
        self.use_case_id = config["use_case_id"]
        self.tag_filters = config["tags"]
        self.measure = measure

        self.has_more_results = True
        self.cache: list[ProjectTransactions] = []

    def __iter__(self) -> FetchProjectTransactionVolumes:
        return self

    def __next__(self) -> ProjectTransactions:
        if self.max_transactions == 0:
            # the user is not interested in explicit transactions, return nothing.
            raise StopIteration()

        if not self._cache_empty():
            # data in cache no need to go to the db
            return self._get_from_cache()

        granularity = Granularity(60)

        if self.has_more_results:
            # still data in the db, load cache
            where_conditions = [
                Condition(
                    Column("timestamp"),
                    Op.GTE,
                    deprecated_utcnow() - BOOST_LOW_VOLUME_TRANSACTIONS_QUERY_INTERVAL,
                ),
                Condition(Column("timestamp"), Op.LT, deprecated_utcnow()),
                Condition(Column("metric_id"), Op.EQ, self.metric_id),
                Condition(Column("org_id"), Op.IN, self.org_ids),
            ]
            # Add tag filters from config
            for tag_name, tag_value in self.tag_filters.items():
                tag_string_id = indexer.resolve_shared_org(tag_name)
                tag_column = f"tags_raw[{tag_string_id}]"
                where_conditions.append(Condition(Column(tag_column), Op.EQ, tag_value))

            query = (
                Query(
                    match=Entity(EntityKey.GenericOrgMetricsCounters.value),
                    select=[
                        Function("sum", [Column("value")], "num_transactions"),
                        Column("org_id"),
                        Column("project_id"),
                        AliasedExpression(Column(self.transaction_tag), "transaction_name"),
                    ],
                    groupby=[
                        Column("org_id"),
                        Column("project_id"),
                        AliasedExpression(Column(self.transaction_tag), "transaction_name"),
                    ],
                    where=where_conditions,
                    granularity=granularity,
                    orderby=[
                        OrderBy(Column("org_id"), Direction.ASC),
                        OrderBy(Column("project_id"), Direction.ASC),
                        OrderBy(Column("num_transactions"), Direction.DESC),
                    ],
                )
                .set_limitby(
                    LimitBy(
                        columns=[Column("org_id"), Column("project_id")],
                        count=self.max_transactions,
                    )
                )
                .set_limit(CHUNK_SIZE + 1)
                .set_offset(self.offset)
            )
            request = Request(
                dataset=Dataset.PerformanceMetrics.value,
                app_id="dynamic_sampling",
                query=query,
                tenant_ids={"use_case_id": self.use_case_id.value, "cross_org_query": 1},
            )
            data = raw_snql_query(
                request,
                referrer=Referrer.DYNAMIC_SAMPLING_COUNTERS_FETCH_PROJECTS_WITH_COUNT_PER_TRANSACTION.value,
            )["data"]

            metric_type = self.measure.value
            metrics.incr(
                "dynamic_sampling.boost_low_volume_transactions.query",
                tags={"query_type": "volumes", "metric_type": metric_type},
                sample_rate=1,
            )

            count = len(data)
            self.has_more_results = count > CHUNK_SIZE
            self.offset += CHUNK_SIZE

            if self.has_more_results:
                data = data[:-1]

            self._add_results_to_cache(data)

        # return from cache if empty stops iteration
        return self._get_from_cache()

    def _add_results_to_cache(self, data: list[dict[str, int | float | str]]) -> None:
        transaction_counts: list[tuple[str, float]] = []
        current_org_id: int | None = None
        current_proj_id: int | None = None

        for row in data:
            proj_id = int(row["project_id"])
            org_id = int(row["org_id"])
            transaction_name = str(row["transaction_name"])
            num_transactions = float(row["num_transactions"])
            if current_proj_id != proj_id or current_org_id != org_id:
                if (
                    transaction_counts
                    and current_proj_id is not None
                    and current_org_id is not None
                ):
                    self.cache.append(
                        {
                            "project_id": current_proj_id,
                            "org_id": current_org_id,
                            "transaction_counts": transaction_counts,
                            "total_num_transactions": None,
                            "total_num_classes": None,
                        }
                    )

                transaction_counts = []
                current_org_id = org_id
                current_proj_id = proj_id
            transaction_counts.append((transaction_name, num_transactions))

        # collect the last project data
        if transaction_counts:
            # since we accumulated some transactions we must have set the org and proj
            assert current_proj_id is not None
            assert current_org_id is not None
            self.cache.append(
                {
                    "project_id": current_proj_id,
                    "org_id": current_org_id,
                    "transaction_counts": transaction_counts,
                    "total_num_transactions": None,
                    "total_num_classes": None,
                }
            )

    def _cache_empty(self) -> bool:
        return not self.cache

    def _get_from_cache(self) -> ProjectTransactions:
        if self._cache_empty():
            raise StopIteration()

        return self.cache.pop(0)
