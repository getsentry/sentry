import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Mapping, Sequence

from snuba_sdk import Column, Condition, Direction, Entity, Granularity, Op, OrderBy, Query

from sentry.release_health.release_monitor.base import BaseReleaseMonitorBackend, Totals
from sentry.sentry_metrics.indexer.strings import SESSION_METRIC_NAMES
from sentry.snuba.dataset import Dataset, EntityKey
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
                                SESSION_METRIC_NAMES["c:sessions/session@none"],
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
                with metrics.timer("release_monitor.fetch_project_release_health_totals.query"):
                    query = (
                        Query(
                            dataset=Dataset.Metrics.value,
                            match=Entity(EntityKey.MetricsCounters.value),
                            select=[
                                # TODO: What will this be? Sum of value?
                                Column("sessions"),
                            ],
                            groupby=[
                                Column("org_id"),
                                Column("project_id"),
                                Column("release"),
                                Column("environment"),
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
                                    SESSION_METRIC_NAMES["c:sessions/session@none"],
                                ),
                            ],
                            granularity=Granularity(21600),
                            orderby=[
                                OrderBy(Column("org_id"), Direction.ASC),
                                OrderBy(Column("project_id"), Direction.ASC),
                            ],
                        )
                        .set_limit(self.CHUNK_SIZE + 1)
                        .set_offset(offset)
                    )

                    data = raw_snql_query(
                        query, referrer="release_monitor.fetch_project_release_health_totals"
                    )["data"]
                    count = len(data)
                    more_results = count > self.CHUNK_SIZE
                    offset += self.CHUNK_SIZE

                    if more_results:
                        data = data[:-1]

                    for row in data:
                        row_totals = totals[row["project_id"]].setdefault(
                            row["environment"], {"total_sessions": 0, "releases": defaultdict(int)}
                        )
                        row_totals["total_sessions"] += row["sessions"]
                        row_totals["releases"][row["release"]] += row["sessions"]

                if not more_results:
                    break
            else:
                logger.error(
                    "fetch_project_release_health_totals.loop_timeout",
                    extra={"org_id": org_id, "project_ids": project_ids},
                )
        return totals
