import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Mapping, Sequence

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

from sentry.sentry_metrics.indexer.strings import TRANSACTION_METRICS_NAMES
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)
MAX_SECONDS = 60
CHUNK_SIZE = 1000


def fetch_projects_with_total_volumes() -> Mapping[int, Sequence[int]]:
    """
    This function fetch with pagination orgs and projects with count per root project
    """
    aggregated_projects = defaultdict(list)
    start_time = time.time()
    offset = 0
    while (time.time() - start_time) < MAX_SECONDS:
        query = (
            Query(
                match=Entity(EntityKey.GenericOrgMetricsCounters.value),
                select=[
                    Function("sum", [Column("value")], "root_count_value"),
                    Column("org_id"),
                    Column("project_id"),
                ],
                groupby=[Column("org_id"), Column("project_id")],
                where=[
                    Condition(Column("timestamp"), Op.GTE, datetime.utcnow() - timedelta(hours=6)),
                    Condition(Column("timestamp"), Op.LT, datetime.utcnow()),
                    Condition(
                        Column("metric_id"),
                        Op.EQ,
                        TRANSACTION_METRICS_NAMES[TransactionMRI.COUNT_PER_ROOT_PROJECT.value],
                    ),
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
            referrer="dynamic_sampling.fetch_projects_with_count_per_root_total_volumes",
        )["data"]
        count = len(data)
        more_results = count > CHUNK_SIZE
        offset += CHUNK_SIZE

        if more_results:
            data = data[:-1]

        for row in data:
            aggregated_projects[row["org_id"]].append({row["project_id"]: row["root_count_value"]})

        if not more_results:
            break

    else:
        logger.error(
            "",
            extra={"offset": offset},
        )

    return aggregated_projects
