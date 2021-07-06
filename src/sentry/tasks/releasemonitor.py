import logging
import time
from datetime import datetime, timedelta

from django.db.models import Q
from django.utils import timezone
from sentry_sdk import capture_exception

# from snuba_sdk import Condition, Column, Direction, Entity, Granularity, Op, OrderBy, Query
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.expressions import Granularity
from snuba_sdk.orderby import Direction, OrderBy
from snuba_sdk.query import Column, Entity, Query

from sentry.models import Release, ReleaseProjectEnvironment
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics, snuba

REQUIRED_ADOPTION_PERCENT = 0.1
CHUNK_SIZE = 1000
MAX_SECONDS = 60

logger = logging.getLogger("tasks.releasemonitor")


@instrumented_task(
    name="sentry.tasks.monitor_release_adoption",
    queue="releasemonitor",
    default_retry_delay=5,
    max_retries=5,
)
def monitor_release_adoption(**kwargs):
    metrics.incr("sentry.tasks.monitor_release_adoption.start")
    # 1. Query snuba for all project ids that have sessions.
    with metrics.timer("sentry.tasks.monitor_release_adoption.aggregate_projects.loop"):
        #     aggregated_projects = defaultdict(list)
        #     time_start = time.time()
        #     offset = 0
        #     while (time.time() - time_start) < MAX_SECONDS:
        #         query = Query(
        #             dataset="sessions",
        #             match=Entity("org_sessions"),
        #             select=[
        #                 Column("org_id"),
        #                 Column("project_id"),
        #             ],
        #             groupby=[Column("org_id"),Column("project_id")],
        #             where=[
        #                 Condition(
        #                     Column("started"), Op.GTE, datetime.utcnow() - timedelta(hours=6)
        #                 ),
        #                 Condition(Column("started"), Op.LT, datetime.utcnow()),
        #             ],
        #             granularity=Granularity(3600),
        #             orderby=[OrderBy(Column("org_id"), Direction.ASC)],
        #         ).set_limit(CHUNK_SIZE+1).set_offset(offset)
        #         data = snuba.raw_snql_query(query, referrer="tasks.monitor_release_adoption")["data"]
        #         count = len(data)
        #         more_results = count >= CHUNK_SIZE
        #         offset += count

        #         for row in data:
        #             aggregated_projects[row['org_id']].append(row['project_id'])

        #         if not more_results:
        #             break

        #     else:
        #         logger.info(
        #             "monitor_release_adoption.loop_timeout",
        #             extra={"offset": offset},
        #         )
        # NOTE: Hardcoded data for sentry org and sentry project for early release, in the same format snuba should return
        aggregated_projects = {1: [1]}  # sentry org id: sentry project id

    with metrics.timer("sentry.tasks.monitor_release_adoption.process_projects_with_sessions"):
        for org_id in aggregated_projects:
            process_projects_with_sessions.delay(org_id, aggregated_projects[org_id])


@instrumented_task(
    name="sentry.tasks.process_projects_with_sessions",
    queue="releasemonitor",
    default_retry_delay=5,
    max_retries=5,
)
def process_projects_with_sessions(org_id, project_ids):
    # Expects a single org id and a list of project ids

    # 2. For each org result from #1, get counts of releases across all envs + projects for the last 6 hours
    time_start = time.time()
    offset = 0
    total_sessions = 0
    adopted_ids = []
    with metrics.timer("sentry.tasks.monitor_release_adoption.process_projects_with_sessions.loop"):
        while (time.time() - time_start) < MAX_SECONDS:
            with metrics.timer(
                "sentry.tasks.monitor_release_adoption.process_projects_with_sessions.query"
            ):
                query = (
                    Query(
                        dataset="sessions",
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
                                Column("started"), Op.GTE, datetime.utcnow() - timedelta(hours=6)
                            ),
                            Condition(Column("started"), Op.LT, datetime.utcnow()),
                            Condition(Column("org_id"), Op.EQ, org_id),
                            Condition(Column("project_id"), Op.IN, project_ids),
                        ],
                        granularity=Granularity(21600),
                        orderby=[OrderBy(Column("org_id"), Direction.ASC)],
                    )
                    .set_limit(CHUNK_SIZE + 1)
                    .set_offset(offset)
                    .set_totals(True)
                )
                results = snuba.raw_snql_query(
                    query, referrer="tasks.process_projects_with_sessions"
                )
                data = results["data"]
                count = len(data)
                more_results = count >= CHUNK_SIZE
                offset += count
                total_sessions = results["totals"]["sessions"]

            # 3. Using the sums from #2, calculate adoption rate (relevant sessions / all sessions) update the appropriate ReleaseProjectEnvironment model adopted/unadopted fields.
            with metrics.timer(
                "sentry.tasks.monitor_release_adoption.process_projects_with_sessions.updates"
            ):
                for row in data:
                    try:
                        if row["sessions"] / total_sessions >= REQUIRED_ADOPTION_PERCENT:
                            rpe = ReleaseProjectEnvironment.objects.get(
                                project_id=row["project_id"],
                                release_id__in=Release.objects.filter(
                                    organization=org_id, version=row["release"]
                                ).values("id")[:1],
                                environment__name=row["environment"],
                                environment__organization_id=org_id,
                            )
                            adopted_ids.append(rpe.id)
                            if rpe.adopted is None:
                                rpe.update(adopted=timezone.now())
                    except ReleaseProjectEnvironment.DoesNotExist as exc:
                        metrics.incr("sentry.tasks.process_projects_with_sessions.skipped_update")
                        capture_exception(exc)

            if not more_results:
                break
        else:
            logger.info(
                "process_projects_with_sessions.loop_timeout",
                extra={"org_id": org_id, "project_ids": project_ids},
            )

    # 4. Cleanup - releases that are marked as adopted that didn’t get any results in #2 need to be marked as unadopted
    ReleaseProjectEnvironment.objects.filter(
        project_id__in=project_ids, unadopted__isnull=True
    ).exclude(Q(adopted=None) | Q(id__in=adopted_ids)).update(unadopted=timezone.now())
