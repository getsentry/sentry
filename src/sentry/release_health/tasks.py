import logging
import random
from collections.abc import Sequence
from datetime import datetime, timedelta
from typing import Any, TypedDict, int

from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.db.models import F, Q
from django.utils import timezone
from sentry_sdk import capture_exception

from sentry import options
from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.models.release import Release, ReleaseStatus
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.release_health import release_monitor
from sentry.release_health.release_monitor.base import Totals
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import release_health_tasks
from sentry.taskworker.retry import Retry
from sentry.utils import metrics

CHUNK_SIZE = 1000
MAX_SECONDS = 60

# Sampling rate for updating ReleaseProjectEnvironment.last_seen
LAST_SEEN_UPDATE_SAMPLE_RATE = 0.01  # 1%

logger = logging.getLogger("sentry.tasks.releasemonitor")


@instrumented_task(
    name="sentry.release_health.tasks.monitor_release_adoption",
    namespace=release_health_tasks,
    retry=Retry(times=5, on=(Exception,)),
    processing_deadline_duration=400,
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
    namespace=release_health_tasks,
    retry=Retry(times=5, on=(Exception,), delay=5),
    processing_deadline_duration=160,
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
    # Process all releases with sessions: update last_seen, and if they meet the 10% threshold, handle adoption logic.
    adopted_ids = []
    current_time = timezone.now()
    cutoff_time = current_time - timedelta(seconds=60)

    with metrics.timer(
        "sentry.tasks.monitor_release_adoption.process_projects_with_sessions.updates"
    ):
        # Single loop: process all releases with sessions
        for project_id, project_totals in totals.items():
            for environment_name, env_totals in project_totals.items():
                total_sessions = env_totals["total_sessions"]

                for release_version, session_count in env_totals["releases"].items():
                    # If this release meets the adoption threshold, handle adoption logic
                    if valid_environment(environment_name, total_sessions):
                        if session_count > 0:  # Has session activity
                            # Always update last_seen for any release with sessions
                            _update_last_seen(
                                org_id,
                                current_time,
                                cutoff_time,
                                project_id,
                                environment_name,
                                release_version,
                            )
                        if valid_and_adopted_release(
                            release_version, session_count, total_sessions
                        ):
                            rpe = _handle_release_adoption(
                                org_id, project_id, environment_name, release_version, current_time
                            )
                            if rpe:
                                adopted_ids.append(rpe.id)

    return adopted_ids


def _update_last_seen(
    org_id, current_time, cutoff_time, project_id, environment_name, release_version
):
    # Skip last_seen updates when the disable option is set (default True)
    if options.get("release-health.disable-release-last-seen-update", True):
        return

    if random.random() >= LAST_SEEN_UPDATE_SAMPLE_RATE:
        return

    try:
        ReleaseProjectEnvironment.objects.filter(
            project_id=project_id,
            release__organization_id=org_id,
            release__version=release_version,
            environment__name=environment_name,
            environment__organization_id=org_id,
            last_seen__lt=current_time - timedelta(seconds=60),  # Only update if >60 seconds old
        ).update(last_seen=current_time)
    except Exception as e:
        logger.warning(
            "Failed to update last_seen for release",
            extra={
                "org_id": org_id,
                "project_id": project_id,
                "release_version": release_version,
                "environment": environment_name,
                "error": str(e),
            },
        )


def _handle_release_adoption(
    org_id: int,
    project_id: int,
    environment_name: str,
    release_version: str,
    current_time: datetime,
) -> ReleaseProjectEnvironment | None:
    """
    Handle adoption logic for a single release that meets the adoption threshold.
    Returns the ReleaseProjectEnvironment instance if successful, None otherwise.
    """
    rpe = None
    try:
        rpe = ReleaseProjectEnvironment.objects.get(
            project_id=project_id,
            release_id=Release.objects.get(organization=org_id, version=release_version).id,
            environment__name=environment_name,
            environment__organization_id=org_id,
        )

        updates: dict[str, Any] = {}

        if rpe.adopted is None:
            updates["adopted"] = current_time

        if rpe.unadopted is not None:
            updates["unadopted"] = None

        # Note: last_seen already updated in main loop

        if updates:
            rpe.update(**updates)

        # Emit metric indicating updated
        metrics.incr("sentry.tasks.process_projects_with_sessions.updated_rpe")

    except (Release.DoesNotExist, ReleaseProjectEnvironment.DoesNotExist):
        metrics.incr("sentry.tasks.process_projects_with_sessions.creating_rpe")
        try:
            env = Environment.objects.get_or_create(name=environment_name, organization_id=org_id)[
                0
            ]
            try:
                release = Release.objects.get_or_create(
                    organization_id=org_id,
                    version=release_version,
                    defaults={
                        "status": ReleaseStatus.OPEN,
                    },
                )[0]
            except IntegrityError:
                release = Release.objects.get(organization_id=org_id, version=release_version)
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
                    adopted=current_time,
                    last_seen=current_time,
                )
        except (
            Project.DoesNotExist,
            Environment.DoesNotExist,
            Release.DoesNotExist,
            ReleaseEnvironment.DoesNotExist,
        ) as exc:
            metrics.incr("sentry.tasks.process_projects_with_sessions.skipped_update")
            capture_exception(exc)

    return rpe


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
