from collections.abc import Callable, Iterator, Sequence
from datetime import datetime
from typing import TypedDict, cast

import sentry_sdk
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

from sentry import options, quotas
from sentry.dynamic_sampling.models.base import ModelType
from sentry.dynamic_sampling.models.common import RebalancedItem, guarded_run
from sentry.dynamic_sampling.models.factory import model_factory
from sentry.dynamic_sampling.models.transactions_rebalancing import TransactionsRebalancingInput
from sentry.dynamic_sampling.tasks.common import GetActiveOrgs, TimedIterator
from sentry.dynamic_sampling.tasks.constants import (
    BOOST_LOW_VOLUME_TRANSACTIONS_QUERY_INTERVAL,
    CHUNK_SIZE,
    DEFAULT_REDIS_CACHE_KEY_TTL,
    MAX_PROJECTS_PER_QUERY,
    MAX_TASK_SECONDS,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_projects import (
    get_boost_low_volume_projects_sample_rate,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_transactions import (
    set_transactions_resampling_rates,
)
from sentry.dynamic_sampling.tasks.logging import log_sample_rate_source
from sentry.dynamic_sampling.tasks.task_context import DynamicSamplingLogState, TaskContext
from sentry.dynamic_sampling.tasks.utils import (
    dynamic_sampling_task,
    dynamic_sampling_task_with_context,
    sample_function,
)
from sentry.dynamic_sampling.utils import has_dynamic_sampling, is_project_mode_sampling
from sentry.models.options.project_option import ProjectOption
from sentry.models.organization import Organization
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task
from sentry.tasks.relay import schedule_invalidate_project_config
from sentry.utils.snuba import raw_snql_query


class ProjectIdentity(TypedDict, total=True):
    """
    Project identity, used to match projects and also to
    order them
    """

    project_id: int
    org_id: int


class ProjectTransactions(TypedDict, total=True):
    """
    Information about the project transactions
    """

    project_id: int
    org_id: int
    transaction_counts: list[tuple[str, float]]
    total_num_transactions: float | None
    total_num_classes: int | None


class ProjectTransactionsTotals(TypedDict, total=True):
    project_id: int
    org_id: int
    total_num_transactions: float
    total_num_classes: int


@instrumented_task(
    name="sentry.dynamic_sampling.tasks.boost_low_volume_transactions",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=6 * 60,  # 6 minutes
    time_limit=6 * 60 + 5,
    silo_mode=SiloMode.REGION,
)
@dynamic_sampling_task_with_context(max_task_execution=MAX_TASK_SECONDS)
def boost_low_volume_transactions(context: TaskContext) -> None:
    num_big_trans = int(
        options.get("dynamic-sampling.prioritise_transactions.num_explicit_large_transactions")
    )
    num_small_trans = int(
        options.get("dynamic-sampling.prioritise_transactions.num_explicit_small_transactions")
    )

    get_totals_name = "GetTransactionTotals"
    get_volumes_small = "GetTransactionVolumes(small)"
    get_volumes_big = "GetTransactionVolumes(big)"

    orgs_iterator = TimedIterator(context, GetActiveOrgs(max_projects=MAX_PROJECTS_PER_QUERY))
    for orgs in orgs_iterator:
        # get the low and high transactions
        totals_it = TimedIterator(
            context=context,
            inner=FetchProjectTransactionTotals(orgs),
            name=get_totals_name,
        )
        small_transactions_it = TimedIterator(
            context=context,
            inner=FetchProjectTransactionVolumes(
                orgs,
                large_transactions=False,
                max_transactions=num_small_trans,
            ),
            name=get_volumes_small,
        )
        big_transactions_it = TimedIterator(
            context=context,
            inner=FetchProjectTransactionVolumes(
                orgs,
                large_transactions=True,
                max_transactions=num_big_trans,
            ),
            name=get_volumes_big,
        )

        for project_transactions in transactions_zip(
            totals_it, big_transactions_it, small_transactions_it
        ):
            boost_low_volume_transactions_of_project.apply_async(
                kwargs={"project_transactions": project_transactions},
                headers={"sentry-propagate-traces": False},
            )


@instrumented_task(
    name="sentry.dynamic_sampling.boost_low_volume_transactions_of_project",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=4 * 60,  # 4 minutes
    time_limit=4 * 60 + 5,
    silo_mode=SiloMode.REGION,
)
@dynamic_sampling_task
def boost_low_volume_transactions_of_project(project_transactions: ProjectTransactions) -> None:
    org_id = project_transactions["org_id"]
    project_id = project_transactions["project_id"]
    total_num_transactions = project_transactions.get("total_num_transactions")
    total_num_classes = project_transactions.get("total_num_classes")
    transactions = [
        RebalancedItem(id=id, count=count)
        for id, count in project_transactions["transaction_counts"]
    ]

    try:
        organization = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        organization = None

    # If the org doesn't have dynamic sampling, we want to early return to avoid unnecessary work.
    if not has_dynamic_sampling(organization):
        return

    if is_project_mode_sampling(organization):
        sample_rate = ProjectOption.objects.get_value(project_id, "sentry:target_sample_rate")
        source = "project_setting"
    else:
        # We try to use the sample rate that was individually computed for each project, but if we don't find it, we will
        # resort to the blended sample rate of the org.
        sample_rate, success = get_boost_low_volume_projects_sample_rate(
            org_id=org_id,
            project_id=project_id,
            error_sample_rate_fallback=quotas.backend.get_blended_sample_rate(
                organization_id=org_id
            ),
        )
        source = "boost_low_volume_projects" if success else "blended_sample_rate"

    sample_function(
        function=log_sample_rate_source,
        _sample_rate=0.1,
        org_id=org_id,
        project_id=project_id,
        used_for="boost_low_volume_transactions",
        source=source,
        sample_rate=sample_rate,
    )

    if sample_rate is None:
        sentry_sdk.capture_message(
            "Sample rate of project not found when trying to adjust the sample rates of "
            "its transactions"
        )
        return

    if sample_rate == 1.0:
        return

    intensity = options.get("dynamic-sampling.prioritise_transactions.rebalance_intensity", 1.0)

    model = model_factory(ModelType.TRANSACTIONS_REBALANCING)
    rebalanced_transactions = guarded_run(
        model,
        TransactionsRebalancingInput(
            classes=transactions,
            sample_rate=sample_rate,
            total_num_classes=total_num_classes,
            total=total_num_transactions,
            intensity=intensity,
        ),
    )
    # In case the result of the model is None, it means that an error occurred, thus we want to early return.
    if rebalanced_transactions is None:
        return

    # Only after checking the nullability of rebalanced_transactions, we want to unpack the tuple.
    named_rates, implicit_rate = rebalanced_transactions
    set_transactions_resampling_rates(
        org_id=org_id,
        proj_id=project_id,
        named_rates=named_rates,
        default_rate=implicit_rate,
        ttl_ms=DEFAULT_REDIS_CACHE_KEY_TTL,
    )

    schedule_invalidate_project_config(
        project_id=project_id, trigger="dynamic_sampling_boost_low_volume_transactions"
    )


def is_same_project(left: ProjectIdentity | None, right: ProjectIdentity | None) -> bool:
    if left is None or right is None:
        return False

    return left["project_id"] == right["project_id"] and left["org_id"] == right["org_id"]


def is_project_identity_before(left: ProjectIdentity, right: ProjectIdentity) -> bool:
    return left["org_id"] < right["org_id"] or (
        left["org_id"] == right["org_id"] and left["project_id"] < right["project_id"]
    )


class FetchProjectTransactionTotals:
    """
    Fetches the total number of transactions and the number of distinct transaction types for each
    project in the given organisations
    """

    def __init__(self, orgs: Sequence[int]):
        self.log_state: DynamicSamplingLogState | None = None

        transaction_string_id = indexer.resolve_shared_org("transaction")
        self.transaction_tag = f"tags_raw[{transaction_string_id}]"
        self.metric_id = indexer.resolve_shared_org(
            str(TransactionMRI.COUNT_PER_ROOT_PROJECT.value)
        )

        self.org_ids = list(orgs)
        self.offset = 0
        self.has_more_results = True
        self.cache: list[dict[str, int | float]] = []
        self.last_org_id: int | None = None

    def __iter__(self):
        return self

    def __next__(self):

        self._ensure_log_state()
        assert self.log_state is not None

        self.log_state.num_iterations += 1

        if not self._cache_empty():
            return self._get_from_cache()

        if self.has_more_results:
            query = (
                Query(
                    match=Entity(EntityKey.GenericOrgMetricsCounters.value),
                    select=[
                        Function("sum", [Column("value")], "num_transactions"),
                        Function("uniq", [Column(self.transaction_tag)], "num_classes"),
                        Column("org_id"),
                        Column("project_id"),
                    ],
                    groupby=[
                        Column("org_id"),
                        Column("project_id"),
                    ],
                    where=[
                        Condition(
                            Column("timestamp"),
                            Op.GTE,
                            datetime.utcnow() - BOOST_LOW_VOLUME_TRANSACTIONS_QUERY_INTERVAL,
                        ),
                        Condition(Column("timestamp"), Op.LT, datetime.utcnow()),
                        Condition(Column("metric_id"), Op.EQ, self.metric_id),
                        Condition(Column("org_id"), Op.IN, self.org_ids),
                    ],
                    granularity=Granularity(3600),
                    orderby=[
                        OrderBy(Column("org_id"), Direction.ASC),
                        OrderBy(Column("project_id"), Direction.ASC),
                    ],
                )
                .set_limit(CHUNK_SIZE + 1)
                .set_offset(self.offset)
            )
            request = Request(
                dataset=Dataset.PerformanceMetrics.value,
                app_id="dynamic_sampling",
                query=query,
                tenant_ids={"use_case_id": UseCaseID.TRANSACTIONS.value, "cross_org_query": 1},
            )
            data = raw_snql_query(
                request,
                referrer=Referrer.DYNAMIC_SAMPLING_COUNTERS_FETCH_PROJECTS_WITH_TRANSACTION_TOTALS.value,
            )["data"]
            count = len(data)
            self.has_more_results = count > CHUNK_SIZE
            self.offset += CHUNK_SIZE

            if self.has_more_results:
                data = data[:-1]

            self.log_state.num_rows_total += count
            self.log_state.num_db_calls += 1

            self.cache.extend(data)

        return self._get_from_cache()

    def _get_from_cache(self):

        if self._cache_empty():
            raise StopIteration()

        self._ensure_log_state()

        assert self.log_state is not None

        row = self.cache.pop(0)
        proj_id = row["project_id"]
        org_id = row["org_id"]
        num_transactions = row["num_transactions"]
        num_classes = row["num_classes"]

        self.log_state.num_projects += 1

        if self.last_org_id != org_id:
            self.last_org_id = cast(int, org_id)
            self.log_state.num_orgs += 1

        return {
            "project_id": proj_id,
            "org_id": org_id,
            "total_num_transactions": num_transactions,
            "total_num_classes": num_classes,
        }

    def _cache_empty(self):
        return not self.cache

    def _ensure_log_state(self):
        if self.log_state is None:
            self.log_state = DynamicSamplingLogState()

    def get_current_state(self):
        """
        Returns the current state of the iterator (how many orgs and projects it has iterated over)

        part of the ContexIterator protocol

        """
        self._ensure_log_state()

        return self.log_state

    def set_current_state(self, log_state: DynamicSamplingLogState) -> None:
        """
        Set the log state from outside (typically immediately after creation)

        part of the ContextIterator protocol

        This is typically used when multiple iterators are concatenated into one logical operation
        in order to accumulate results into one state.
        """
        self.log_state = log_state


class FetchProjectTransactionVolumes:
    """
    Fetch transactions for all orgs and all projects  with pagination orgs and projects with count per root project

    org_ids: the orgs for which the projects & transactions should be returned

    large_transactions: if True it returns transactions with the largest count
                        if False it returns transactions with the smallest count

    max_transactions: maximum number of transactions to return
    """

    def __init__(
        self,
        orgs: list[int],
        large_transactions: bool,
        max_transactions: int,
    ):
        self.log_state: DynamicSamplingLogState | None = None

        self.large_transactions = large_transactions
        self.max_transactions = max_transactions
        self.org_ids = orgs
        self.offset = 0
        transaction_string_id = indexer.resolve_shared_org("transaction")
        self.transaction_tag = f"tags_raw[{transaction_string_id}]"
        self.metric_id = indexer.resolve_shared_org(
            str(TransactionMRI.COUNT_PER_ROOT_PROJECT.value)
        )
        self.has_more_results = True
        self.cache: list[ProjectTransactions] = []

        if self.large_transactions:
            self.transaction_ordering = Direction.DESC
        else:
            self.transaction_ordering = Direction.ASC

    def __iter__(self):
        return self

    def __next__(self) -> ProjectTransactions:

        self._ensure_log_state()
        assert self.log_state is not None

        self.log_state.num_iterations += 1

        if self.max_transactions == 0:
            # the user is not interested in transactions of this type, return nothing.
            raise StopIteration()

        if not self._cache_empty():
            # data in cache no need to go to the db
            return self._get_from_cache()

        if self.has_more_results:
            # still data in the db, load cache
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
                    where=[
                        Condition(
                            Column("timestamp"),
                            Op.GTE,
                            datetime.utcnow() - BOOST_LOW_VOLUME_TRANSACTIONS_QUERY_INTERVAL,
                        ),
                        Condition(Column("timestamp"), Op.LT, datetime.utcnow()),
                        Condition(Column("metric_id"), Op.EQ, self.metric_id),
                        Condition(Column("org_id"), Op.IN, self.org_ids),
                    ],
                    granularity=Granularity(3600),
                    orderby=[
                        OrderBy(Column("org_id"), Direction.ASC),
                        OrderBy(Column("project_id"), Direction.ASC),
                        OrderBy(Column("num_transactions"), self.transaction_ordering),
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
                tenant_ids={"use_case_id": UseCaseID.TRANSACTIONS.value, "cross_org_query": 1},
            )
            data = raw_snql_query(
                request,
                referrer=Referrer.DYNAMIC_SAMPLING_COUNTERS_FETCH_PROJECTS_WITH_COUNT_PER_TRANSACTION.value,
            )["data"]

            count = len(data)
            self.has_more_results = count > CHUNK_SIZE
            self.offset += CHUNK_SIZE

            if self.has_more_results:
                data = data[:-1]

            self.log_state.num_rows_total += count
            self.log_state.num_db_calls += 1

            self._add_results_to_cache(data)

        # return from cache if empty stops iteration
        return self._get_from_cache()

    def _add_results_to_cache(self, data):
        transaction_counts: list[tuple[str, float]] = []
        current_org_id: int | None = None
        current_proj_id: int | None = None

        self._ensure_log_state()
        assert self.log_state is not None

        for row in data:
            proj_id = row["project_id"]
            org_id = row["org_id"]
            transaction_name = row["transaction_name"]
            num_transactions = row["num_transactions"]
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
                    if current_proj_id != proj_id:
                        self.log_state.num_projects += 1
                    if current_org_id != org_id:
                        self.log_state.num_orgs += 1

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

    def _cache_empty(self):
        return not self.cache

    def _get_from_cache(self) -> ProjectTransactions:
        if self._cache_empty():
            raise StopIteration()

        return self.cache.pop(0)

    def _ensure_log_state(self):
        if self.log_state is None:
            self.log_state = DynamicSamplingLogState()

    def get_current_state(self):
        """
        Returns the current state of the iterator (how many orgs and projects it has iterated over)

        part of the ContexIterator protocol

        """
        self._ensure_log_state()

        return self.log_state

    def set_current_state(self, log_state: DynamicSamplingLogState) -> None:
        """
        Set the log state from outside (typically immediately after creation)

        part of the ContextIterator protocol

        This is typically used when multiple iterators are concatenated into one logical operation
        in order to accumulate results into one state.
        """
        self.log_state = log_state


def merge_transactions(
    left: ProjectTransactions,
    right: ProjectTransactions | None,
    totals: ProjectTransactionsTotals | None,
) -> ProjectTransactions:
    if right is None and left is None:
        raise ValueError(
            "no transactions passed to merge",
        )

    if left is not None and right is not None and not is_same_project(left, right):
        raise ValueError(
            "mismatched project transactions",
            (left["org_id"], left["project_id"]),
            (right["org_id"], right["project_id"]),
        )

    if totals is not None and not is_same_project(left, totals):
        raise ValueError(
            "mismatched projectTransaction and projectTransactionTotals",
            (left["org_id"], left["project_id"]),
            (totals["org_id"], totals["project_id"]),
        )

    assert left is not None

    if right is None:
        merged_transactions = left["transaction_counts"]
    else:
        # we have both left and right we need to merge
        names = set()
        merged_transactions = [*left["transaction_counts"]]
        for transaction_name, _ in merged_transactions:
            names.add(transaction_name)

        for transaction_name, count in right["transaction_counts"]:
            if transaction_name not in names:
                # not already in left, add it
                merged_transactions.append((transaction_name, count))

    return {
        "org_id": left["org_id"],
        "project_id": left["project_id"],
        "transaction_counts": merged_transactions,
        "total_num_transactions": (
            totals.get("total_num_transactions") if totals is not None else None
        ),
        "total_num_classes": totals.get("total_num_classes") if totals is not None else None,
    }


def next_totals(
    totals: Iterator[ProjectTransactionsTotals],
) -> Callable[[ProjectIdentity], ProjectTransactionsTotals | None]:
    """
    Advances the total iterator until it reaches the required identity

    Given a match the iterator returns None if it cannot find it ( i.e. it is
    already past it) or it is at the end (it never terminates, DO NOT use it
    in a for loop). If it finds the match it will return the total for the match.

    """
    current: list[ProjectTransactionsTotals | None] = [None]
    # protection for the case when the caller passes a list instead of an iterator
    totals = iter(totals)

    def inner(match: ProjectIdentity) -> ProjectTransactionsTotals | None:
        if is_same_project(current[0], match):
            temp = current[0]
            current[0] = None
            return temp

        if current[0] is not None and is_project_identity_before(match, current[0]):
            # still haven't reach current no point looking further
            return None

        for total in totals:
            if is_same_project(total, match):
                # found it
                return total

            if is_project_identity_before(match, total):
                # we passed after match, remember were we are no need to go further
                current[0] = total
                return None
        return None

    return inner


def transactions_zip(
    totals: Iterator[ProjectTransactionsTotals],
    left: Iterator[ProjectTransactions],
    right: Iterator[ProjectTransactions],
) -> Iterator[ProjectTransactions]:
    """
    returns a generator that zips left and right (when they match) and when not it re-aligns the sequence

    if it finds a totals to match it consolidates the result with totals information as well
    """

    more_right = True
    more_left = True
    left_elm = None
    right_elm = None

    get_next_total = next_totals(totals)

    while more_left or more_right:
        if more_right and right_elm is None:
            try:
                right_elm = next(right)
            except StopIteration:
                more_right = False
                right_elm = None
        if more_left and left_elm is None:
            try:
                left_elm = next(left)
            except StopIteration:
                more_left = False
                left_elm = None

        if left_elm is None and right_elm is None:
            return

        if right_elm is not None and left_elm is not None:
            # we have both right and left try to merge them if they point to the same entity
            if is_same_project(left_elm, right_elm):
                yield merge_transactions(left_elm, right_elm, get_next_total(left_elm))
                left_elm = None
                right_elm = None
            elif is_project_identity_before(left_elm, right_elm):
                # left is before right (return left keep right for next iteration)
                yield merge_transactions(left_elm, None, get_next_total(left_elm))
                left_elm = None
            else:  # project_before(right_elm, left_elm):
                # right before left ( return right keep left for next iteration)
                yield merge_transactions(right_elm, None, get_next_total(right_elm))
                right_elm = None
        else:
            # only one is not None
            if left_elm is not None:
                yield merge_transactions(left_elm, None, get_next_total(left_elm))
                left_elm = None
            elif right_elm is not None:
                yield merge_transactions(right_elm, None, get_next_total(right_elm))
                right_elm = None
