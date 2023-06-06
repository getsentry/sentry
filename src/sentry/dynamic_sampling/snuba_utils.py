import logging
import time
from datetime import datetime, timedelta
from typing import Generator, List, Tuple

from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Granularity,
    Op,
    OrderBy,
    Query,
    Request,
)

from sentry.sentry_metrics import indexer
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)
MAX_SECONDS = 60
CHUNK_SIZE = 9998  # Snuba's limit is 10000 and we fetch CHUNK_SIZE+1
MAX_ORGS_PER_QUERY = 100
MAX_PROJECTS_PER_QUERY = 5000
MAX_TRANSACTIONS_PER_PROJECT = 20


def get_orgs_with_project_counts_without_modulo(
    max_orgs: int, max_projects: int
) -> Generator[List[int], None, None]:
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
                    Condition(Column("timestamp"), Op.GTE, datetime.utcnow() - timedelta(hours=1)),
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


def get_active_orgs(max_orgs: int, time_interval: timedelta) -> Generator[List[int], None, None]:
    """
    Fetch organisations in batches.
    A batch will return at max max_orgs elements
    """
    start_time = time.time()
    metric_id = indexer.resolve_shared_org(str(TransactionMRI.COUNT_PER_ROOT_PROJECT.value))
    offset = 0

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
                    Condition(Column("timestamp"), Op.GTE, datetime.utcnow() - time_interval),
                    Condition(Column("timestamp"), Op.LT, datetime.utcnow()),
                    Condition(Column("metric_id"), Op.EQ, metric_id),
                ],
                granularity=Granularity(60),
                orderby=[
                    OrderBy(Column("org_id"), Direction.ASC),
                ],
            )
            .set_limit(max_orgs + 1)
            .set_offset(offset)
        )
        request = Request(
            dataset=Dataset.PerformanceMetrics.value, app_id="dynamic_sampling", query=query
        )
        data = raw_snql_query(
            request,
            referrer=Referrer.DYNAMIC_SAMPLING_COUNTERS_GET_ACTIVE_ORGS.value,
        )["data"]
        count = len(data)
        more_results = count > max_orgs
        offset += max_orgs
        if more_results:
            data = data[:-1]

        ret_val = []

        for row in data:
            ret_val.append(row["org_id"])

        yield ret_val

        if not more_results:
            return
