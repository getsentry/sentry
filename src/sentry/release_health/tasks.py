import logging
from collections.abc import Iterator, Sequence
from typing import Any, TypedDict

from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.db.models import F, Q
from django.utils import timezone
from sentry_sdk import capture_exception

from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.models.release import Release, ReleaseStatus
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.release_health import release_monitor
from sentry.release_health.release_monitor.base import Totals
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import release_health_tasks
from sentry.taskworker.retry import Retry
from sentry.utils import metrics

CHUNK_SIZE = 1000
MAX_SECONDS = 60

logger = logging.getLogger("sentry.tasks.releasemonitor")


@instrumented_task(
    name="sentry.release_health.tasks.monitor_release_adoption",
    queue="releasemonitor",
    default_retry_delay=5,
    max_retries=5,
    taskworker_config=TaskworkerConfig(
        namespace=release_health_tasks, retry=Retry(times=5, on=(Exception,))
    ),
)
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
    taskworker_config=TaskworkerConfig(
        namespace=release_health_tasks,
        retry=Retry(
            times=5,
            on=(Exception,),
            delay=5,
        ),
        processing_deadline_duration=160,
    ),
)
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
        for adopted_release in iter_adopted_releases(totals):
            rpe = None
            try:
                rpe = ReleaseProjectEnvironment.objects.get(
                    project_id=adopted_release["project_id"],
                    release_id=Release.objects.get(
                        organization=org_id, version=adopted_release["version"]
                    ).id,
                    environment__name=adopted_release["environment"],
                    environment__organization_id=org_id,
                )

                updates: dict[str, Any] = {}
                if rpe.adopted is None:
                    updates["adopted"] = timezone.now()

                if rpe.unadopted is not None:
                    updates["unadopted"] = None

                if updates:
                    rpe.update(**updates)

                # Emit metric indicating updated. Not interested in the actual row being
                # updated. More that this step completed successfully.
                metrics.incr("sentry.tasks.process_projects_with_sessions.updated_rpe")
            except (Release.DoesNotExist, ReleaseProjectEnvironment.DoesNotExist):
                metrics.incr("sentry.tasks.process_projects_with_sessions.creating_rpe")
                try:
                    env = Environment.objects.get_or_create(
                        name=adopted_release["environment"], organization_id=org_id
                    )[0]
                    try:
                        release = Release.objects.get_or_create(
                            organization_id=org_id,
                            version=adopted_release["version"],
                            defaults={
                                "status": ReleaseStatus.OPEN,
                            },
                        )[0]
                    except IntegrityError:
                        release = Release.objects.get(
                            organization_id=org_id, version=adopted_release["version"]
                        )
                    except ValidationError:
                        release = None
                        logger.exception(
                            "sentry.tasks.process_projects_with_sessions.creating_rpe.ValidationError",
                            extra={
                                "org_id": org_id,
                                "release_version": adopted_release["version"],
                            },
                        )

                    if release:
                        release.add_project(Project.objects.get(id=adopted_release["project_id"]))

                        ReleaseEnvironment.objects.get_or_create(
                            environment=env, organization_id=org_id, release=release
                        )

                        rpe = ReleaseProjectEnvironment.objects.create(
                            project_id=adopted_release["project_id"],
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
                    metrics.incr("sentry.tasks.process_projects_with_sessions.skipped_update")
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


class AdoptedRelease(TypedDict):
    environment: str
    project_id: int
    version: str


def iter_adopted_releases(totals: Totals) -> Iterator[AdoptedRelease]:
    """Iterate through the totals set yielding the totals which are valid.

    The totals object is deeply nested. This function flattens it, validates that its a valid
    release row, and returns a flat representation. This is easier to work with and enables
    release-health monitoring code to take on a flatter form which is easier to read and test.
    """
    for p_id, p_totals in totals.items():
        for e_name, e_totals in p_totals.items():
            if valid_environment(e_name, e_totals["total_sessions"]):
                for release_version, release_count in e_totals["releases"].items():
                    if valid_and_adopted_release(
                        release_version, release_count, e_totals["total_sessions"]
                    ):
                        yield {
                            "environment": e_name,
                            "project_id": p_id,
                            "version": release_version,
                        }


def valid_environment(environment_name: str, environment_session_count: int) -> bool:
    """An environment is valid if it has a name and has at least one session."""
    return bool(environment_name) and environment_session_count > 0


def valid_and_adopted_release(
    release_name: str, release_session_count: int, environment_session_count: int
) -> bool:
    """A release is valid if it has the correct name and it has been adopted."""
    return Release.is_valid_version(release_name) and has_been_adopted(
        environment_session_count, release_session_count
    )


def has_been_adopted(total_sessions: int, total_sessions_for_release: int) -> bool:
    """If the release's sessions exceed 10% of total sessions it is considered adopted.

    https://docs.sentry.io/product/releases/health/#adoption-stages
    """
    threshold = total_sessions * 0.1
    return total_sessions_for_release >= threshold
