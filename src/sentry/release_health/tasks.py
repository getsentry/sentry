import logging
from typing import Sequence

from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.db.models import F, Q
from django.utils import timezone
from sentry_sdk import capture_exception

from sentry.models import (
    Environment,
    Project,
    Release,
    ReleaseEnvironment,
    ReleaseProjectEnvironment,
    ReleaseStatus,
)
from sentry.release_health import release_monitor
from sentry.release_health.release_monitor.base import Totals
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics

CHUNK_SIZE = 1000
MAX_SECONDS = 60

logger = logging.getLogger("sentry.tasks.releasemonitor")


@instrumented_task(
    name="sentry.release_health.tasks.monitor_release_adoption",
    queue="releasemonitor",
    default_retry_delay=5,
    max_retries=5,
)  # type: ignore
def monitor_release_adoption(**kwargs) -> None:
    metrics.incr("sentry.tasks.monitor_release_adoption.start", sample_rate=1.0)
    with metrics.timer(
        "sentry.tasks.monitor_release_adoption.process_projects_with_sessions", sample_rate=1.0
    ):
        for org_id, project_ids in release_monitor.fetch_projects_with_recent_sessions().items():
            process_projects_with_sessions.delay(org_id, project_ids)


@instrumented_task(
    name="sentry.tasks.process_projects_with_sessions",
    queue="releasemonitor",
    default_retry_delay=5,
    max_retries=5,
)  # type: ignore
def process_projects_with_sessions(org_id, project_ids) -> None:
    # Takes a single org id and a list of project ids

    with metrics.timer("sentry.tasks.monitor_release_adoption.process_projects_with_sessions.core"):
        # Set the `has_sessions` flag for these projects
        Project.objects.filter(
            organization_id=org_id,
            id__in=project_ids,
            flags=F("flags").bitand(~Project.flags.has_sessions),
        ).update(flags=F("flags").bitor(Project.flags.has_sessions))

        totals = release_monitor.fetch_project_release_health_totals(org_id, project_ids)

        adopted_ids = adopt_releases(org_id, totals)

        cleanup_adopted_releases(project_ids, adopted_ids)


def adopt_releases(org_id: int, totals: Totals) -> Sequence[int]:
    # Using the totals calculated in sum_sessions_and_releases, mark any releases as adopted if they reach a threshold.
    adopted_ids = []
    with metrics.timer(
        "sentry.tasks.monitor_release_adoption.process_projects_with_sessions.updates"
    ):
        for project_id, project_totals in totals.items():
            for environment, environment_totals in project_totals.items():
                total_releases = len(environment_totals["releases"])
                for release_version in environment_totals["releases"]:
                    # Ignore versions that were saved with an empty string
                    if not Release.is_valid_version(release_version):
                        continue

                    threshold = 0.1 / total_releases
                    if (
                        environment
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
                                except ValidationError:
                                    release = None
                                    logger.exception(
                                        "sentry.tasks.process_projects_with_sessions.creating_rpe.ValidationError",
                                        extra={
                                            "org_id": org_id,
                                            "release_version": release_version,
                                        },
                                    )

                                if release:
                                    release.add_project(Project.objects.get(id=project_id))

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
                            ) as exc:
                                metrics.incr(
                                    "sentry.tasks.process_projects_with_sessions.skipped_update"
                                )
                                capture_exception(exc)
                        if rpe:
                            adopted_ids.append(rpe.id)

    return adopted_ids


def cleanup_adopted_releases(project_ids: Sequence[int], adopted_ids: Sequence[int]) -> None:
    # Cleanup; adopted releases need to be marked as unadopted if they are not in `adopted_ids`
    with metrics.timer(
        "sentry.tasks.monitor_release_adoption.process_projects_with_sessions.cleanup"
    ):
        ReleaseProjectEnvironment.objects.filter(
            project_id__in=project_ids, unadopted__isnull=True
        ).exclude(Q(adopted=None) | Q(id__in=adopted_ids)).update(unadopted=timezone.now())
