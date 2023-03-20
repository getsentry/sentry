import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Mapping, Sequence, Tuple

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

from sentry import options
from sentry.dynamic_sampling.rules.utils import OrganizationId, ProjectId
from sentry.sentry_metrics import indexer
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.snuba.referrer import Referrer
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)
MAX_SECONDS = 60
CHUNK_SIZE = 9998  # Snuba's limit is 10000, and we fetch CHUNK_SIZE+1


def fetch_projects_with_total_volumes() -> Mapping[OrganizationId, Sequence[Tuple[ProjectId, int]]]:
    """
    This function fetch with pagination orgs and projects with count per root project
    """
    aggregated_projects = defaultdict(list)
    start_time = time.time()
    offset = 0
    sample_rate = int(options.get("dynamic-sampling.prioritise_projects.sample_rate") * 100)
    metric_id = indexer.resolve_shared_org(str(TransactionMRI.COUNT_PER_ROOT_PROJECT.value))
    where = [
        Condition(Column("timestamp"), Op.GTE, datetime.utcnow() - timedelta(hours=1)),
        Condition(Column("timestamp"), Op.LT, datetime.utcnow()),
        Condition(Column("metric_id"), Op.EQ, metric_id),
    ]
    if sample_rate != 100:
        where += [Condition(Function("modulo", [Column("org_id"), 100]), Op.LT, sample_rate)]

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
                where=where,
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
            "",
            extra={"offset": offset},
        )

    return aggregated_projects
