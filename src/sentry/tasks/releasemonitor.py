import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta

from django.db.models import Q
from django.utils import timezone
from sentry_sdk import capture_exception
from snuba_sdk import Column, Condition, Direction, Entity, Granularity, Op, OrderBy, Query

from sentry.models import Release, ReleaseProjectEnvironment
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics, snuba

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
        #     start_time = time.time()
        #     offset = 0
        #     while (time.time() - start_time) < MAX_SECONDS:
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
    # Takes a single org id and a list of project ids

    # 2. For each org result from #1, get counts of releases across all envs + projects for the last 6 hours
    start_time = time.time()
    offset = 0
    adopted_ids = []
    totals = defaultdict(dict)
    with metrics.timer("sentry.tasks.monitor_release_adoption.process_projects_with_sessions.loop"):
        while (time.time() - start_time) < MAX_SECONDS:
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
                )

                data = snuba.raw_snql_query(
                    query, referrer="tasks.process_projects_with_sessions.session_count"
                )["data"]
                count = len(data)
                more_results = count >= CHUNK_SIZE
                offset += count
                for row in data:
                    totals[row["project_id"]].setdefault(
                        row["environment"], {"total_sessions": 0, "releases": defaultdict(int)}
                    )
                    totals[row["project_id"]][row["environment"]]["total_sessions"] += row[
                        "sessions"
                    ]
                    totals[row["project_id"]][row["environment"]]["releases"][
                        row["release"]
                    ] += row["sessions"]

            if not more_results:
                break
        else:
            logger.info(
                "process_projects_with_sessions.loop_timeout",
                extra={"org_id": org_id, "project_ids": project_ids},
            )
    # 3. Using the sums from the previous step, calculate adoption status
    with metrics.timer(
        "sentry.tasks.monitor_release_adoption.process_projects_with_sessions.updates"
    ):
        for project_id in totals:
            for environment in totals[project_id]:
                total_releases = len(totals[project_id][environment]["releases"])
                for release in totals[project_id][environment]["releases"]:
                    threshold = 0.1 / total_releases
                    if (
                        totals[project_id][environment]["releases"][release]
                        / totals[project_id][environment]["total_sessions"]
                        >= threshold
                    ):
                        try:
                            rpe = ReleaseProjectEnvironment.objects.get(
                                project_id=project_id,
                                release_id__in=Release.objects.filter(
                                    organization=org_id, version=release
                                ).values("id")[:1],
                                environment__name=environment,
                                environment__organization_id=org_id,
                            )
                            adopted_ids.append(rpe.id)
                            if rpe.adopted is None:
                                rpe.update(adopted=timezone.now())
                        except ReleaseProjectEnvironment.DoesNotExist as exc:
                            metrics.incr(
                                "sentry.tasks.process_projects_with_sessions.skipped_update"
                            )
                            capture_exception(exc)

    # 4. Cleanup - releases that are marked as adopted that didn’t get any results in #2 need to be marked as unadopted
    with metrics.timer(
        "sentry.tasks.monitor_release_adoption.process_projects_with_sessions.cleaup"
    ):
        ReleaseProjectEnvironment.objects.filter(
            project_id__in=project_ids, unadopted__isnull=True
        ).exclude(Q(adopted=None) | Q(id__in=adopted_ids)).update(unadopted=timezone.now())
