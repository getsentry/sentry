import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Mapping, Sequence

from snuba_sdk import Column, Condition, Direction, Entity, Granularity, Op, OrderBy, Query, Request

from sentry.release_health.release_monitor.base import BaseReleaseMonitorBackend, Totals
from sentry.utils import metrics
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)


class SessionReleaseMonitorBackend(BaseReleaseMonitorBackend):
    def fetch_projects_with_recent_sessions(self) -> Mapping[int, Sequence[int]]:
        with metrics.timer(
            "sentry.tasks.monitor_release_adoption.aggregate_projects.loop", sample_rate=1.0
        ):
            aggregated_projects = defaultdict(list)
            start_time = time.time()
            offset = 0
            while (time.time() - start_time) < self.MAX_SECONDS:
                query = (
                    Query(
                        match=Entity("org_sessions"),
                        select=[
                            Column("org_id"),
                            Column("project_id"),
                        ],
                        groupby=[Column("org_id"), Column("project_id")],
                        where=[
                            Condition(
                                Column("started"), Op.GTE, datetime.utcnow() - timedelta(hours=6)
                            ),
                            Condition(Column("started"), Op.LT, datetime.utcnow()),
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
                request = Request(dataset="sessions", app_id="sessions_release_health", query=query)
                data = raw_snql_query(request, referrer="tasks.monitor_release_adoption")["data"]
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
                    "monitor_release_adoption.loop_timeout",
                    extra={"offset": offset},
                )

        return aggregated_projects

    def fetch_project_release_health_totals(
        self, org_id: int, project_ids: Sequence[int]
    ) -> Totals:
        start_time = time.time()
        offset = 0
        totals: Totals = defaultdict(dict)
        with metrics.timer(
            "sentry.tasks.monitor_release_adoption.process_projects_with_sessions.loop"
        ):
            while (time.time() - start_time) < self.MAX_SECONDS:
                with metrics.timer(
                    "sentry.tasks.monitor_release_adoption.process_projects_with_sessions.query"
                ):
                    query = (
                        Query(
                            match=Entity("sessions"),
                            select=[
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
                                    Column("started"),
                                    Op.GTE,
                                    datetime.utcnow() - timedelta(hours=6),
                                ),
                                Condition(Column("started"), Op.LT, datetime.utcnow()),
                                Condition(Column("org_id"), Op.EQ, org_id),
                                Condition(Column("project_id"), Op.IN, project_ids),
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
                    request = Request(
                        dataset="sessions", app_id="sessions_release_health", query=query
                    )
                    data = raw_snql_query(
                        request, referrer="tasks.process_projects_with_sessions.session_count"
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
                    "process_projects_with_sessions.loop_timeout",
                    extra={"org_id": org_id, "project_ids": project_ids},
                )
        return totals
