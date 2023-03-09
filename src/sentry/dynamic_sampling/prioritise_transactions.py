import logging
import time
from datetime import datetime, timedelta
from typing import Iterator, List, Optional, Tuple, TypedDict, cast

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


class ProjectTransactions(TypedDict, total=True):
    project_id: int
    org_id: int
    transaction_counts: List[Tuple[str, int]]


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
    load_rate = int(options.get("dynamic-sampling.prioritise_transactions.load_rate") * 100)
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
                    Condition(Function("modulo", [Column("org_id"), 100]), Op.LT, load_rate),
                    Condition(Column("timestamp"), Op.GTE, datetime.utcnow() - timedelta(hours=6)),
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
    if len(last_result) > 0:
        yield [org_id for org_id, _ in last_result]


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
    start_time = time.time()
    offset = 0
    org_ids = list(org_ids)  # just to be sure it is not some other sequence
    transaction_string_id = indexer.resolve_shared_org("transaction")
    transaction_tag = f"tags_raw[{transaction_string_id}]"
    metric_id = indexer.resolve_shared_org(str(TransactionMRI.COUNT_PER_ROOT_PROJECT.value))
    current_org_id: Optional[int] = None
    current_proj_id: Optional[int] = None
    transaction_counts: List[Tuple[str, int]] = []

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
                    Condition(Column("timestamp"), Op.GTE, datetime.utcnow() - timedelta(hours=6)),
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
                }
            break
    else:
        logger.error(
            "",
            extra={"offset": offset},
        )

    return None


def merge_transactions(
    left: ProjectTransactions, right: ProjectTransactions
) -> ProjectTransactions:
    if left["org_id"] != right["org_id"]:
        raise ValueError(
            "missmatched orgs while merging transactions", left["org_id"], right["org_id"]
        )
    if left["project_id"] != right["project_id"]:
        raise ValueError(
            "missmatched projects while merging transactions",
            left["project_id"],
            right["project_id"],
        )

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
    }


def transactions_zip(
    left: Iterator[ProjectTransactions],
    right: Iterator[ProjectTransactions],
) -> Iterator[ProjectTransactions]:
    """
    returns a generator that zips left and right (when they match) and when not it re-aligns the sequence
    """

    more_right = True
    more_left = True
    left_elm = None
    right_elm = None
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

        if right_elm is not None and left_elm is not None:
            # we have both right and left try to merge them if they point to the same entity
            if (
                left_elm["org_id"] == right_elm["org_id"]
                and left_elm["project_id"] == right_elm["project_id"]
            ):
                yield merge_transactions(left_elm, right_elm)
                left_elm = None
                right_elm = None
            else:
                # the two elements do not match see which one is "smaller" and return it, keep the other
                # for the next iteration
                if left_elm["org_id"] < right_elm["org_id"]:
                    yield left_elm
                    left_elm = None
                elif left_elm["org_id"] > right_elm["org_id"]:
                    yield right_elm
                    right_elm = None
                # orgs are the sam try projects
                elif left_elm["project_id"] < right_elm["project_id"]:
                    yield left_elm
                    left_elm = None
                else:  # right_elm["project_id"] > left_elm["project_id"]
                    yield right_elm
                    right_elm = None
        else:
            if left_elm is not None:
                yield left_elm
                left_elm = None
            if right_elm is not None:
                yield right_elm
                right_elm = None
