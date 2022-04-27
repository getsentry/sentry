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
)

# from sentry import release_health
from sentry.release_health.release_monitor.base import BaseReleaseMonitorBackend, Totals
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.indexer.strings import SESSION_METRIC_NAMES
from sentry.sentry_metrics.utils import resolve_tag_key
from sentry.snuba.dataset import Dataset, EntityKey

# from sentry.snuba.metrics import QueryDefinition, MetricField, get_series, OrderBy as MetricsOrderBy, MetricOperationType
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
                        dataset=Dataset.Metrics.value,
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
                                SESSION_METRIC_NAMES[SessionMRI.SESSION.value],
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
                data = raw_snql_query(
                    query, referrer="release_monitor.fetch_projects_with_recent_sessions"
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
                # query = QueryDefinition(
                #     org_id=org_id,
                #     project_ids=project_ids,
                #     select=[
                #         MetricField("sum", "sentry.sessions.session"),
                #         MetricField(None, "project_id"),
                #         MetricField(None, "release"),
                #         MetricField(None, "environment"),
                #     ],
                #     start=datetime.utcnow() - timedelta(hours=6),
                #     end=datetime.utcnow(),
                #     granularity=Granularity(21600),
                #     where=[Condition(
                #         Column("metric_id"),
                #         Op.EQ,
                #         indexer.resolve(org_id, SessionMRI.SESSION.value),
                #     )],
                #     groupby=[
                #         Column("project_id"),
                #         Column(resolve_tag_key(org_id, "release")),
                #         Column(resolve_tag_key(org_id, "environment")),
                #     ],
                #     orderby=MetricsOrderBy(MetricField(None, "project_id"), Direction.ASC),
                #     limit=self.CHUNK_SIZE + 1,
                #     offset=offset,
                # )
                release_key = resolve_tag_key(org_id, "release")
                release_col = Column(release_key)
                env_key = resolve_tag_key(org_id, "environment")
                env_col = Column(env_key)
                query = (
                    Query(
                        dataset=Dataset.Metrics.value,
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
                                indexer.resolve(org_id, SessionMRI.SESSION.value),
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

                with metrics.timer("release_monitor.fetch_project_release_health_totals.query"):
                    # data = get_series(project_ids, query)
                    data = raw_snql_query(
                        query, referrer="release_monitor.fetch_projects_with_recent_sessions"
                    )["data"]
                    count = len(data)
                    more_results = count > self.CHUNK_SIZE
                    offset += self.CHUNK_SIZE

                    if more_results:
                        data = data[:-1]

                    for row in data:
                        env_name = indexer.reverse_resolve(row[env_key])
                        release_name = indexer.reverse_resolve(row[release_key])
                        row_totals = totals[row["project_id"]].setdefault(
                            env_name, {"total_sessions": 0, "releases": defaultdict(int)}
                        )
                        row_totals["total_sessions"] += row["sessions"]
                        row_totals["releases"][release_name] += row["sessions"]

                if not more_results:
                    break
            else:
                logger.error(
                    "fetch_project_release_health_totals.loop_timeout",
                    extra={"org_id": org_id, "project_ids": project_ids},
                )
        return totals
