import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Mapping, Sequence

from snuba_sdk import Column, Condition, Direction, Entity, Granularity, Op, OrderBy, Query

from sentry.release_health.release_monitor.base import BaseReleaseMonitorBackend
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
                        dataset="sessions",
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
                data = raw_snql_query(query, referrer="tasks.monitor_release_adoption")["data"]
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
