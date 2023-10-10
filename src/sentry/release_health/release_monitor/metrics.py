import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Mapping, Sequence, Set

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
from sentry.sentry_metrics.indexer.strings import SESSION_METRIC_NAMES
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.sentry_metrics.utils import resolve_tag_key
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.naming_layer.mri import SessionMRI
from sentry.utils import metrics
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)


class MetricReleaseMonitorBackend(BaseReleaseMonitorBackend):
    def fetch_projects_with_recent_sessions(self) -> Mapping[int, Sequence[int]]:
        with metrics.timer(
            "release_monitor.fetch_projects_with_recent_sessions.loop", sample_rate=1.0
        ):
            aggregated_projects = defaultdict(list)
            start_time = time.time()
            offset = 0
            while (time.time() - start_time) < self.MAX_SECONDS:
                query = (
                    Query(
                        match=Entity(EntityKey.OrgMetricsCounters.value),
                        select=[
                            Column("org_id"),
                            Column("project_id"),
                        ],
                        groupby=[Column("org_id"), Column("project_id")],
                        where=[
                            Condition(
                                Column("timestamp"), Op.GTE, datetime.utcnow() - timedelta(hours=6)
                            ),
                            Condition(Column("timestamp"), Op.LT, datetime.utcnow()),
                            Condition(
                                Column("metric_id"),
                                Op.EQ,
                                SESSION_METRIC_NAMES[SessionMRI.RAW_SESSION.value],
                            ),
                        ],
                        granularity=Granularity(3600),
                        orderby=[
                            OrderBy(Column("org_id"), Direction.ASC),
                            OrderBy(Column("project_id"), Direction.ASC),
                        ],
                    )
                    .set_limit(self.CHUNK_SIZE + 1)
                    .set_offset(offset)
                )
                request = Request(
                    dataset=Dataset.Metrics.value, app_id="release_health", query=query
                )
                data = raw_snql_query(
                    request, referrer="release_monitor.fetch_projects_with_recent_sessions"
                )["data"]
                count = len(data)
                more_results = count > self.CHUNK_SIZE
                offset += self.CHUNK_SIZE

                if more_results:
                    data = data[:-1]

                for row in data:
                    aggregated_projects[row["org_id"]].append(row["project_id"])

                if not more_results:
                    break

            else:
                logger.error(
                    "release_monitor.fetch_projects_with_recent_sessions.loop_timeout",
                    extra={"offset": offset},
                )

        return aggregated_projects

    def fetch_project_release_health_totals(
        self, org_id: int, project_ids: Sequence[int]
    ) -> Totals:
        start_time = time.time()
        offset = 0
        totals: Totals = defaultdict(dict)
        with metrics.timer("release_monitor.fetch_project_release_health_totals.loop"):
            while (time.time() - start_time) < self.MAX_SECONDS:
                release_key = resolve_tag_key(UseCaseID.SESSIONS, org_id, "release")
                release_col = Column(release_key)
                env_key = resolve_tag_key(UseCaseID.SESSIONS, org_id, "environment")
                env_col = Column(env_key)
                query = (
                    Query(
                        match=Entity(EntityKey.MetricsCounters.value),
                        select=[
                            Function("sum", [Column("value")], "sessions"),
                            Column("project_id"),
                            release_col,
                            env_col,
                        ],
                        groupby=[
                            Column("project_id"),
                            release_col,
                            env_col,
                        ],
                        where=[
                            Condition(
                                Column("timestamp"),
                                Op.GTE,
                                datetime.utcnow() - timedelta(hours=6),
                            ),
                            Condition(Column("timestamp"), Op.LT, datetime.utcnow()),
                            Condition(Column("org_id"), Op.EQ, org_id),
                            Condition(Column("project_id"), Op.IN, project_ids),
                            Condition(
                                Column("metric_id"),
                                Op.EQ,
                                indexer.resolve(
                                    UseCaseID.SESSIONS, org_id, SessionMRI.RAW_SESSION.value
                                ),
                            ),
                        ],
                        granularity=Granularity(21600),
                        orderby=[
                            OrderBy(Column("project_id"), Direction.ASC),
                            OrderBy(release_col, Direction.ASC),
                            OrderBy(env_col, Direction.ASC),
                        ],
                    )
                    .set_limit(self.CHUNK_SIZE + 1)
                    .set_offset(offset)
                )
                request = Request(
                    dataset=Dataset.Metrics.value,
                    app_id="release_health",
                    query=query,
                    tenant_ids={"organization_id": org_id},
                )
                with metrics.timer("release_monitor.fetch_project_release_health_totals.query"):
                    data = raw_snql_query(
                        request, "release_monitor.fetch_project_release_health_totals"
                    )["data"]
                    count = len(data)
                    more_results = count > self.CHUNK_SIZE
                    offset += self.CHUNK_SIZE

                    if more_results:
                        data = data[:-1]

                    # convert indexes back to strings
                    indexes: Set[int] = set()
                    for row in data:
                        indexes.add(row[env_key])
                        indexes.add(row[release_key])
                    resolved_strings = indexer.bulk_reverse_resolve(
                        UseCaseID.SESSIONS, org_id, indexes
                    )

                    for row in data:
                        env_name = resolved_strings.get(row[env_key])
                        release_name = resolved_strings.get(row[release_key])
                        row_totals = totals[row["project_id"]].setdefault(
                            env_name, {"total_sessions": 0, "releases": defaultdict(int)}  # type: ignore
                        )
                        row_totals["total_sessions"] += row["sessions"]
                        row_totals["releases"][release_name] += row["sessions"]  # type: ignore

                if not more_results:
                    break
            else:
                logger.error(
                    "fetch_project_release_health_totals.loop_timeout",
                    extra={"org_id": org_id, "project_ids": project_ids},
                )
        return totals
