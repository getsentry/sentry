import time
from datetime import datetime
from typing import Callable, Iterator, List, Optional, Tuple, TypedDict

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
from sentry.dynamic_sampling.rules.base import (
    is_sliding_window_enabled,
    is_sliding_window_org_enabled,
)
from sentry.dynamic_sampling.tasks.constants import (
    BOOST_LOW_VOLUME_TRANSACTIONS_QUERY_INTERVAL,
    CHUNK_SIZE,
    DEFAULT_REDIS_CACHE_KEY_TTL,
    MAX_ORGS_PER_QUERY,
    MAX_PROJECTS_PER_QUERY,
    MAX_SECONDS,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_projects import (
    get_boost_low_volume_projects_sample_rate,
)
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_transactions import (
    set_transactions_resampling_rates,
)
from sentry.dynamic_sampling.tasks.helpers.sliding_window import get_sliding_window_sample_rate
from sentry.dynamic_sampling.tasks.logging import log_query_timeout, log_sample_rate_source
from sentry.dynamic_sampling.tasks.utils import dynamic_sampling_task
from sentry.models import Organization
from sentry.sentry_metrics import indexer
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
    transaction_counts: List[Tuple[str, float]]
    total_num_transactions: Optional[float]
    total_num_classes: Optional[int]


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
    soft_time_limit=2 * 60 * 60,
    time_limit=2 * 60 * 60 + 5,
)
@dynamic_sampling_task
def boost_low_volume_transactions() -> None:
    num_big_trans = int(
        options.get("dynamic-sampling.prioritise_transactions.num_explicit_large_transactions")
    )
    num_small_trans = int(
        options.get("dynamic-sampling.prioritise_transactions.num_explicit_small_transactions")
    )

    for orgs in get_orgs_with_project_counts():
        # get the low and high transactions
        for project_transactions in transactions_zip(
            fetch_project_transaction_totals(orgs),
            fetch_transactions_with_total_volumes(
                orgs,
                large_transactions=True,
                max_transactions=num_big_trans,
            ),
            fetch_transactions_with_total_volumes(
                orgs,
                large_transactions=False,
                max_transactions=num_small_trans,
            ),
        ):
            boost_low_volume_transactions_of_project.delay(project_transactions)


@instrumented_task(
    name="sentry.dynamic_sampling.boost_low_volume_transactions_of_project",
    queue="dynamicsampling",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=25 * 60,
    time_limit=2 * 60 + 5,
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

    # By default, this bias uses the blended sample rate.
    sample_rate = quotas.backend.get_blended_sample_rate(organization_id=org_id)

    # In case we have specific feature flags enabled, we will change the sample rate either basing ourselves
    # on sliding window per project or per org.
    if organization is not None and is_sliding_window_enabled(organization):
        sample_rate = get_sliding_window_sample_rate(
            org_id=org_id, project_id=project_id, error_sample_rate_fallback=sample_rate
        )
        log_sample_rate_source(
            org_id, project_id, "boost_low_volume_transactions", "sliding_window", sample_rate
        )
    elif organization is not None and is_sliding_window_org_enabled(organization):
        sample_rate = get_boost_low_volume_projects_sample_rate(
            org_id=org_id, project_id=project_id, error_sample_rate_fallback=sample_rate
        )
        log_sample_rate_source(
            org_id,
            project_id,
            "boost_low_volume_transactions",
            "boost_low_volume_projects",
            sample_rate,
        )
    else:
        log_sample_rate_source(
            org_id, project_id, "boost_low_volume_transactions", "blended_sample_rate", sample_rate
        )

    if sample_rate is None or sample_rate == 1.0:
        # no sampling => no rebalancing
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


def is_same_project(left: Optional[ProjectIdentity], right: Optional[ProjectIdentity]) -> bool:
    if left is None or right is None:
        return False

    return left["project_id"] == right["project_id"] and left["org_id"] == right["org_id"]


def is_project_identity_before(left: ProjectIdentity, right: ProjectIdentity) -> bool:
    return left["org_id"] < right["org_id"] or (
        left["org_id"] == right["org_id"] and left["project_id"] < right["project_id"]
    )


def get_orgs_with_project_counts(
    max_orgs: int = MAX_ORGS_PER_QUERY, max_projects: int = MAX_PROJECTS_PER_QUERY
) -> Iterator[List[int]]:
    """
    Fetch organisations in batches.
    A batch will return at max max_orgs elements
    It will accumulate org ids in the list until either it accumulates max_orgs or the
    number of projects in the already accumulated orgs is more than max_projects or there
    are no more orgs
    """
    start_time = time.time()
    metric_id = indexer.resolve_shared_org(str(TransactionMRI.COUNT_PER_ROOT_PROJECT.value))
    offset = 0

    last_result: List[Tuple[int, int]] = []
    while (time.time() - start_time) < MAX_SECONDS:
        query = (
            Query(
                match=Entity(EntityKey.GenericOrgMetricsCounters.value),
                select=[
                    Function("uniq", [Column("project_id")], "num_projects"),
                    Column("org_id"),
                ],
                groupby=[
                    Column("org_id"),
                ],
                where=[
                    Condition(
                        Column("timestamp"),
                        Op.GTE,
                        datetime.utcnow() - BOOST_LOW_VOLUME_TRANSACTIONS_QUERY_INTERVAL,
                    ),
                    Condition(Column("timestamp"), Op.LT, datetime.utcnow()),
                    Condition(Column("metric_id"), Op.EQ, metric_id),
                ],
                granularity=Granularity(3600),
                orderby=[
                    OrderBy(Column("org_id"), Direction.ASC),
                ],
            )
            .set_limit(CHUNK_SIZE + 1)
            .set_offset(offset)
        )
        request = Request(
            dataset=Dataset.PerformanceMetrics.value, app_id="dynamic_sampling", query=query
        )
        data = raw_snql_query(
            request,
            referrer=Referrer.DYNAMIC_SAMPLING_COUNTERS_FETCH_PROJECTS_WITH_COUNT_PER_TRANSACTION.value,
        )["data"]
        count = len(data)
        more_results = count > CHUNK_SIZE
        offset += CHUNK_SIZE
        if more_results:
            data = data[:-1]
        for row in data:
            last_result.append((row["org_id"], row["num_projects"]))

        first_idx = 0
        count_projects = 0
        for idx, (org_id, num_projects) in enumerate(last_result):
            count_projects += num_projects
            if idx - first_idx >= max_orgs - 1 or count_projects >= max_projects:
                # we got to the number of elements desired
                yield [o for o, _ in last_result[first_idx : idx + 1]]
                first_idx = idx + 1
                count_projects = 0

        # keep what is left unused from last_result for the next iteration or final result
        last_result = last_result[first_idx:]
        if not more_results:
            break
    else:
        log_query_timeout(query="get_orgs_with_project_counts", offset=offset)

    if len(last_result) > 0:
        yield [org_id for org_id, _ in last_result]


def fetch_project_transaction_totals(org_ids: List[int]) -> Iterator[ProjectTransactionsTotals]:
    """
    Fetches the total number of transactions and the number of distinct transaction types for each
    project in the given organisations
    :param org_ids:
    :return: an iterator of org_ids
    """
    start_time = time.time()
    offset = 0
    org_ids = list(org_ids)  # just to be sure it is not some other sequence
    transaction_string_id = indexer.resolve_shared_org("transaction")
    transaction_tag = f"tags_raw[{transaction_string_id}]"
    metric_id = indexer.resolve_shared_org(str(TransactionMRI.COUNT_PER_ROOT_PROJECT.value))
    more_results = True

    while more_results and (time.time() - start_time) < MAX_SECONDS:
        query = (
            Query(
                match=Entity(EntityKey.GenericOrgMetricsCounters.value),
                select=[
                    Function("sum", [Column("value")], "num_transactions"),
                    Function("uniq", [Column(transaction_tag)], "num_classes"),
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
                    Condition(Column("metric_id"), Op.EQ, metric_id),
                    Condition(Column("org_id"), Op.IN, org_ids),
                ],
                granularity=Granularity(3600),
                orderby=[
                    OrderBy(Column("org_id"), Direction.ASC),
                    OrderBy(Column("project_id"), Direction.ASC),
                ],
            )
            .set_limit(CHUNK_SIZE + 1)
            .set_offset(offset)
        )
        request = Request(
            dataset=Dataset.PerformanceMetrics.value, app_id="dynamic_sampling", query=query
        )
        data = raw_snql_query(
            request,
            referrer=Referrer.DYNAMIC_SAMPLING_COUNTERS_FETCH_PROJECTS_WITH_TRANSACTION_TOTALS.value,
        )["data"]
        count = len(data)
        more_results = count > CHUNK_SIZE
        offset += CHUNK_SIZE

        if more_results:
            data = data[:-1]

        for row in data:
            proj_id = row["project_id"]
            org_id = row["org_id"]
            num_transactions = row["num_transactions"]
            num_classes = row["num_classes"]
            yield {
                "project_id": proj_id,
                "org_id": org_id,
                "total_num_transactions": num_transactions,
                "total_num_classes": num_classes,
            }

    else:
        log_query_timeout(query="fetch_project_transaction_totals", offset=offset)

    return None


def fetch_transactions_with_total_volumes(
    org_ids: List[int], large_transactions: bool, max_transactions: int
) -> Iterator[ProjectTransactions]:
    """
    Fetch transactions for all orgs and all projects  with pagination orgs and projects with count per root project

    org_ids: the orgs for which the projects & transactions should be returned

    large_transactions: if True it returns transactions with the largest count
                        if False it returns transactions with the smallest count

    max_transactions: maximum number of transactions to return
    """

    if max_transactions == 0:
        # no transactions required from this end (probably we only need transactions from the other end)
        return None

    start_time = time.time()
    offset = 0
    org_ids = list(org_ids)  # just to be sure it is not some other sequence
    transaction_string_id = indexer.resolve_shared_org("transaction")
    transaction_tag = f"tags_raw[{transaction_string_id}]"
    metric_id = indexer.resolve_shared_org(str(TransactionMRI.COUNT_PER_ROOT_PROJECT.value))
    current_org_id: Optional[int] = None
    current_proj_id: Optional[int] = None
    transaction_counts: List[Tuple[str, float]] = []

    if large_transactions:
        transaction_ordering = Direction.DESC
    else:
        transaction_ordering = Direction.ASC

    while (time.time() - start_time) < MAX_SECONDS:
        query = (
            Query(
                match=Entity(EntityKey.GenericOrgMetricsCounters.value),
                select=[
                    Function("sum", [Column("value")], "num_transactions"),
                    Column("org_id"),
                    Column("project_id"),
                    AliasedExpression(Column(transaction_tag), "transaction_name"),
                ],
                groupby=[
                    Column("org_id"),
                    Column("project_id"),
                    AliasedExpression(Column(transaction_tag), "transaction_name"),
                ],
                where=[
                    Condition(
                        Column("timestamp"),
                        Op.GTE,
                        datetime.utcnow() - BOOST_LOW_VOLUME_TRANSACTIONS_QUERY_INTERVAL,
                    ),
                    Condition(Column("timestamp"), Op.LT, datetime.utcnow()),
                    Condition(Column("metric_id"), Op.EQ, metric_id),
                    Condition(Column("org_id"), Op.IN, org_ids),
                ],
                granularity=Granularity(3600),
                orderby=[
                    OrderBy(Column("org_id"), Direction.ASC),
                    OrderBy(Column("project_id"), Direction.ASC),
                    OrderBy(Column("num_transactions"), transaction_ordering),
                ],
            )
            .set_limitby(
                LimitBy(columns=[Column("org_id"), Column("project_id")], count=max_transactions)
            )
            .set_limit(CHUNK_SIZE + 1)
            .set_offset(offset)
        )
        request = Request(
            dataset=Dataset.PerformanceMetrics.value, app_id="dynamic_sampling", query=query
        )
        data = raw_snql_query(
            request,
            referrer=Referrer.DYNAMIC_SAMPLING_COUNTERS_FETCH_PROJECTS_WITH_COUNT_PER_TRANSACTION.value,
        )["data"]
        count = len(data)
        more_results = count > CHUNK_SIZE
        offset += CHUNK_SIZE

        if more_results:
            data = data[:-1]
        for row in data:
            proj_id = row["project_id"]
            org_id = row["org_id"]
            transaction_name = row["transaction_name"]
            num_transactions = row["num_transactions"]
            if current_proj_id != proj_id or current_org_id != org_id:
                if (
                    len(transaction_counts) > 0
                    and current_proj_id is not None
                    and current_org_id is not None
                ):
                    yield {
                        "project_id": current_proj_id,
                        "org_id": current_org_id,
                        "transaction_counts": transaction_counts,
                        "total_num_transactions": None,
                        "total_num_classes": None,
                    }
                transaction_counts = []
                current_org_id = org_id
                current_proj_id = proj_id
            transaction_counts.append((transaction_name, num_transactions))
        if not more_results:
            if (
                len(transaction_counts) > 0
                and current_proj_id is not None
                and current_org_id is not None
            ):
                yield {
                    "project_id": current_proj_id,
                    "org_id": current_org_id,
                    "transaction_counts": transaction_counts,
                    "total_num_transactions": None,
                    "total_num_classes": None,
                }
            break
    else:
        log_query_timeout(query="fetch_transactions_with_total_volumes", offset=offset)

    return None


def merge_transactions(
    left: ProjectTransactions,
    right: Optional[ProjectTransactions],
    totals: Optional[ProjectTransactionsTotals],
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

    if right is None:
        merged_transactions = left["transaction_counts"]
    else:
        # we have both left and right we need to merge
        transactions = set()
        merged_transactions = [*left["transaction_counts"]]
        for transaction_name, _ in merged_transactions:
            transactions.add(transaction_name)

        for transaction_name, count in right["transaction_counts"]:
            if transaction_name not in transactions:
                # not already in left, add it
                merged_transactions.append((transaction_name, count))

    return {
        "org_id": left["org_id"],
        "project_id": left["project_id"],
        "transaction_counts": merged_transactions,
        "total_num_transactions": totals["total_num_transactions"] if totals is not None else None,
        "total_num_classes": totals["total_num_classes"] if totals is not None else None,
    }


def next_totals(
    totals: Iterator[ProjectTransactionsTotals],
) -> Callable[[ProjectIdentity], Optional[ProjectTransactionsTotals]]:
    """
    Advances the total iterator until it reaches the required identity

    Given a match the iterator returns None if it cannot find it ( i.e. it is
    already past it) or it is at the end (it never terminates, DO NOT use it
    in a for loop). If it finds the match it will return the total for the match.

    """
    current: List[Optional[ProjectTransactionsTotals]] = [None]
    # protection for the case when the caller passes a list instead of an iterator
    totals = iter(totals)

    def inner(match: ProjectIdentity) -> Optional[ProjectTransactionsTotals]:
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
