import logging
import time
from collections import defaultdict
from datetime import datetime, timedelta

from django.db import IntegrityError
from django.db.models import F, Q
from django.utils import timezone
from sentry_sdk import capture_exception
from snuba_sdk import Column, Condition, Direction, Entity, Granularity, Op, OrderBy, Query

from sentry.models import (
    Environment,
    Project,
    Release,
    ReleaseEnvironment,
    ReleaseProject,
    ReleaseProjectEnvironment,
    ReleaseStatus,
)
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
    metrics.incr("sentry.tasks.monitor_release_adoption.start", sample_rate=1.0)
    # 1. Query snuba for all project ids that have sessions.
    with metrics.timer(
        "sentry.tasks.monitor_release_adoption.aggregate_projects.loop", sample_rate=1.0
    ):
        aggregated_projects = defaultdict(list)
        start_time = time.time()
        offset = 0
        while (time.time() - start_time) < MAX_SECONDS:
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
                .set_limit(CHUNK_SIZE + 1)
                .set_offset(offset)
            )
            data = snuba.raw_snql_query(query, referrer="tasks.monitor_release_adoption")["data"]
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
            logger.info(
                "monitor_release_adoption.loop_timeout",
                sample_rate=1.0,
                extra={"offset": offset},
            )
    with metrics.timer(
        "sentry.tasks.monitor_release_adoption.process_projects_with_sessions", sample_rate=1.0
    ):
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

    with metrics.timer("sentry.tasks.monitor_release_adoption.process_projects_with_sessions.core"):
        # Set the `has_sessions` flag for these projects
        Project.objects.filter(
            organization_id=org_id,
            id__in=project_ids,
            flags=F("flags").bitand(~Project.flags.has_sessions),
        ).update(flags=F("flags").bitor(Project.flags.has_sessions))

        totals = sum_sessions_and_releases(org_id, project_ids)

        adopted_ids = adopt_releases(org_id, totals)

        cleanup_adopted_releases(project_ids, adopted_ids)


def sum_sessions_and_releases(org_id, project_ids):
    # Takes a single org id and a list of project ids
    # returns counts of releases and sessions across all environments and passed project_ids for the last 6 hours
    start_time = time.time()
    offset = 0
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
                        orderby=[
                            OrderBy(Column("org_id"), Direction.ASC),
                            OrderBy(Column("project_id"), Direction.ASC),
                        ],
                    )
                    .set_limit(CHUNK_SIZE + 1)
                    .set_offset(offset)
                )

                data = snuba.raw_snql_query(
                    query, referrer="tasks.process_projects_with_sessions.session_count"
                )["data"]
                count = len(data)
                more_results = count > CHUNK_SIZE
                offset += CHUNK_SIZE

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
            logger.info(
                "process_projects_with_sessions.loop_timeout",
                extra={"org_id": org_id, "project_ids": project_ids},
            )
    return totals


def adopt_releases(org_id, totals):
    # Using the totals calculated in sum_sessions_and_releases, mark any releases as adopted if they reach a threshold.
    adopted_ids = []
    with metrics.timer(
        "sentry.tasks.monitor_release_adoption.process_projects_with_sessions.updates"
    ):
        for project_id, project_totals in totals.items():
            for environment, environment_totals in project_totals.items():
                total_releases = len(environment_totals["releases"])
                for release_version in environment_totals["releases"]:
                    threshold = 0.1 / total_releases
                    if (
                        environment != ""
                        and environment_totals["total_sessions"] != 0
                        and environment_totals["releases"][release_version]
                        / environment_totals["total_sessions"]
                        >= threshold
                    ):
                        rpe = None
                        try:
                            rpe = ReleaseProjectEnvironment.objects.get(
                                project_id=project_id,
                                release_id=Release.objects.get(
                                    organization=org_id, version=release_version
                                ).id,
                                environment__name=environment,
                                environment__organization_id=org_id,
                            )

                            updates = {}
                            if rpe.adopted is None:
                                updates["adopted"] = timezone.now()

                            if rpe.unadopted is not None:
                                updates["unadopted"] = None

                            if updates:
                                rpe.update(**updates)

                        except (Release.DoesNotExist, ReleaseProjectEnvironment.DoesNotExist):
                            metrics.incr("sentry.tasks.process_projects_with_sessions.creating_rpe")
                            try:
                                env = Environment.objects.get_or_create(
                                    name=environment, organization_id=org_id
                                )[0]
                                try:
                                    release = Release.objects.get_or_create(
                                        organization_id=org_id,
                                        version=release_version,
                                        defaults={
                                            "status": ReleaseStatus.OPEN,
                                        },
                                    )[0]
                                except IntegrityError:
                                    release = Release.objects.get(
                                        organization_id=org_id, version=release_version
                                    )
                                ReleaseProject.objects.get_or_create(
                                    project_id=project_id, release=release
                                )

                                ReleaseEnvironment.objects.get_or_create(
                                    environment=env, organization_id=org_id, release=release
                                )

                                rpe = ReleaseProjectEnvironment.objects.create(
                                    project_id=project_id,
                                    release_id=release.id,
                                    environment=env,
                                    adopted=timezone.now(),
                                )
                            except (
                                Project.DoesNotExist,
                                Environment.DoesNotExist,
                                Release.DoesNotExist,
                                ReleaseEnvironment.DoesNotExist,
                                ReleaseProject.DoesNotExist,
                            ) as exc:
                                metrics.incr(
                                    "sentry.tasks.process_projects_with_sessions.skipped_update"
                                )
                                capture_exception(exc)
                        if rpe:
                            adopted_ids.append(rpe.id)

    return adopted_ids


def cleanup_adopted_releases(project_ids, adopted_ids):
    # Cleanup; adopted releases need to be marked as unadopted if they are not in `adopted_ids`
    with metrics.timer(
        "sentry.tasks.monitor_release_adoption.process_projects_with_sessions.cleanup"
    ):
        ReleaseProjectEnvironment.objects.filter(
            project_id__in=project_ids, unadopted__isnull=True
        ).exclude(Q(adopted=None) | Q(id__in=adopted_ids)).update(unadopted=timezone.now())
