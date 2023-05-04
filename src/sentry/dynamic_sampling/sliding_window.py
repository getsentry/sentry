import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import List, Mapping, Optional, Sequence, Tuple

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

from sentry.dynamic_sampling.rules.utils import OrganizationId, ProjectId
from sentry.sentry_metrics import indexer
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)
MAX_SECONDS = 60
CHUNK_SIZE = 9998  # Snuba's limit is 10000, and we fetch CHUNK_SIZE+1
QUERY_TIME_INTERVAL = timedelta(
    hours=24
)  # By default, we want to get the volume of the last 24 hours.


def fetch_projects_with_total_root_transactions_count(
    org_ids: List[int],
    granularity: Optional[Granularity] = None,
    query_interval: Optional[timedelta] = None,
) -> Mapping[OrganizationId, Sequence[Tuple[ProjectId, int]]]:
    """
    Fetches tuples of (org_id, project_id) and the respective root transaction counts.
    """
    if query_interval is None:
        query_interval = QUERY_TIME_INTERVAL
        granularity = Granularity(3600)

    count_per_root_metric_id = indexer.resolve_shared_org(
        str(TransactionMRI.COUNT_PER_ROOT_PROJECT.value)
    )
    where = [
        Condition(Column("timestamp"), Op.GTE, datetime.utcnow() - query_interval),
        Condition(Column("timestamp"), Op.LT, datetime.utcnow()),
        Condition(Column("metric_id"), Op.EQ, count_per_root_metric_id),
        Condition(Column("org_id"), Op.IN, list(org_ids)),
    ]

    start_time = time.time()
    offset = 0
    aggregated_projects = defaultdict(list)
    while (time.time() - start_time) < MAX_SECONDS:
        query = (
            Query(
                match=Entity(EntityKey.GenericOrgMetricsCounters.value),
                select=[
                    Function("sum", [Column("value")], "root_count_value"),
                    Column("org_id"),
                    Column("project_id"),
                ],
                where=where,
                groupby=[Column("org_id"), Column("project_id")],
                orderby=[
                    OrderBy(Column("org_id"), Direction.ASC),
                    OrderBy(Column("project_id"), Direction.ASC),
                ],
                granularity=granularity,
            )
            .set_limit(CHUNK_SIZE + 1)
            .set_offset(offset)
        )

        request = Request(
            dataset=Dataset.PerformanceMetrics.value, app_id="dynamic_sampling", query=query
        )

        data = raw_snql_query(
            request,
            referrer=Referrer.DYNAMIC_SAMPLING_DISTRIBUTION_FETCH_PROJECTS_WITH_COUNT_PER_ROOT.value,
        )["data"]

        count = len(data)
        more_results = count > CHUNK_SIZE
        offset += CHUNK_SIZE

        if more_results:
            data = data[:-1]

        for row in data:
            aggregated_projects[row["org_id"]].append((row["project_id"], row["root_count_value"]))

        if not more_results:
            break
    else:
        logger.error(
            f"Fetching the transaction root count of multiple orgs took more than {MAX_SECONDS} seconds.",
            extra={"offset": offset},
        )

    return aggregated_projects
