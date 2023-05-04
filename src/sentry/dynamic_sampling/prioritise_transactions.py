import logging
import time
from datetime import datetime, timedelta
from typing import Callable, Iterator, List, Optional, Tuple, TypedDict, cast

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

from sentry import options
from sentry.sentry_metrics import indexer
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)
MAX_SECONDS = 60
CHUNK_SIZE = 9998  # Snuba's limit is 10000 and we fetch CHUNK_SIZE+1
# Controls the time range on which data is collected
QUERY_TIME_INTERVAL = timedelta(hours=1)


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


def is_same_project(left: Optional[ProjectIdentity], right: Optional[ProjectIdentity]) -> bool:
    if left is None or right is None:
        return False

    return left["project_id"] == right["project_id"] and left["org_id"] == right["org_id"]


def is_project_identity_before(left: ProjectIdentity, right: ProjectIdentity) -> bool:
    return left["org_id"] < right["org_id"] or (
        left["org_id"] == right["org_id"] and left["project_id"] < right["project_id"]
    )


def get_orgs_with_project_counts(max_orgs: int, max_projects: int) -> Iterator[List[int]]:
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

    # TODO remove this when we are happy with the database load
    #   We use this mechanism to be able to adjust the db load, we can control what percentage
    #   of organisations are retrieved from the database.
    load_rate = int(options.get("dynamic-sampling.prioritise_transactions.load_rate") * 100)
    if load_rate <= 99:
        restrict_orgs = [Condition(Function("modulo", [Column("org_id"), 100]), Op.LT, load_rate)]
    else:
        restrict_orgs = []

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
                    Condition(Column("timestamp"), Op.GTE, datetime.utcnow() - QUERY_TIME_INTERVAL),
                    Condition(Column("timestamp"), Op.LT, datetime.utcnow()),
                    Condition(Column("metric_id"), Op.EQ, metric_id),
                ]
                + restrict_orgs,
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
                    Condition(Column("timestamp"), Op.GTE, datetime.utcnow() - QUERY_TIME_INTERVAL),
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
        logger.error(
            "",
            extra={"offset": offset},
        )

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
                    Condition(Column("timestamp"), Op.GTE, datetime.utcnow() - QUERY_TIME_INTERVAL),
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
                if len(transaction_counts) > 0:
                    yield {
                        "project_id": cast(int, current_proj_id),
                        "org_id": cast(int, current_org_id),
                        "transaction_counts": transaction_counts,
                        "total_num_transactions": None,
                        "total_num_classes": None,
                    }
                transaction_counts = []
                current_org_id = org_id
                current_proj_id = proj_id
            transaction_counts.append((transaction_name, num_transactions))
        if not more_results:
            if len(transaction_counts) > 0:
                yield {
                    "project_id": cast(int, current_proj_id),
                    "org_id": cast(int, current_org_id),
                    "transaction_counts": transaction_counts,
                    "total_num_transactions": None,
                    "total_num_classes": None,
                }
            break
    else:
        logger.error(
            "",
            extra={"offset": offset},
        )

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
