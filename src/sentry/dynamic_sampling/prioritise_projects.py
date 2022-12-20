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

from sentry.release_health.release_monitor.base import BaseReleaseMonitorBackend, Totals
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.indexer.strings import SESSION_METRIC_NAMES
from sentry.sentry_metrics.utils import resolve_tag_key
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import SessionMRI
from sentry.utils import metrics
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)
MAX_SECONDS = 60
CHUNK_SIZE = 1000


def fetch_projects_with_total_volumes() -> Mapping[int, Sequence[int]]:
    # TODO: (andrii) include only "disconnected" projects or independent in tracing context
    aggregated_projects = defaultdict(list)
    start_time = time.time()
    offset = 0
    while (time.time() - start_time) < MAX_SECONDS:
        query = (
            Query(
                match=Entity(EntityKey.OrgMetricsCounters.value),
                select=[
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
                        SESSION_METRIC_NAMES[SessionMRI.SESSION.value],
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
        request = Request(dataset=Dataset.Metrics.value, app_id="dynamic_sampling", query=query)
        data = raw_snql_query(
            # TODO: replace to new referrer
            request,
            referrer="dynamic_sampling.fetch_projects_with_recent_sessions",
        )["data"]
        count = len(data)
        more_results = count > CHUNK_SIZE
        offset += CHUNK_SIZE

        if more_results:
            data = data[:-1]

        for row in data:
            aggregated_projects[row["org_id"]].append(row["project_id"])

        if not more_results:
            break

    else:
        logger.error(
            "",
            extra={"offset": offset},
        )

    return aggregated_projects
