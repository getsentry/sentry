from __future__ import annotations

import logging
from collections.abc import Generator
from datetime import datetime, timedelta

import orjson
import requests
from django.conf import settings
from django.utils import timezone as django_timezone

from sentry import features, options
from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.tasks.base import instrumented_task
from sentry.tasks.statistical_detectors import compute_delay
from sentry.taskworker.namespaces import seer_tasks
from sentry.utils.cache import cache
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger("sentry.tasks.seer_explorer_indexer")

CACHE_KEY = "seer:explorer_index:last_run"

# Explorer indexing constants
EXPLORER_INDEX_PROJECTS_PER_BATCH = 100  # Projects per batch sent to seer
EXPLORER_INDEX_RUN_FREQUENCY = timedelta(hours=24)  # runs daily
# Use a larger prime number to spread indexing tasks throughout the day
EXPLORER_INDEX_DISPATCH_STEP = timedelta(seconds=127)


def get_seer_explorer_enabled_projects() -> Generator[tuple[int, int]]:
    """
    Get all active projects that belong to organizations with seer-explorer enabled.

    Yields:
        Tuple of (project_id, organization_id)
    """
    # Get all active projects with their organization
    projects = Project.objects.filter(status=ObjectStatus.ACTIVE).select_related("organization")

    for project in RangeQuerySetWrapper(
        projects,
        result_value_getter=lambda p: p.id,
    ):
        # Check if the organization has seer-explorer feature enabled
        if features.has("organizations:seer-explorer-index", project.organization):
            yield project.id, project.organization_id


@instrumented_task(
    name="sentry.tasks.seer_explorer_index.schedule_explorer_index",
    namespace=seer_tasks,
    processing_deadline_duration=30,
)
def schedule_explorer_index() -> None:
    """
    Main periodic task that runs daily to schedule explorer indexing for active projects
    in seer-enabled organizations. Spreads the load throughout the day.
    """
    if not options.get("seer.explorer_index.enable"):
        return

    last_run = cache.get(CACHE_KEY)
    if last_run and last_run > django_timezone.now() - EXPLORER_INDEX_RUN_FREQUENCY:
        return

    cache.set(CACHE_KEY, django_timezone.now())

    now = django_timezone.now()

    projects = get_seer_explorer_enabled_projects()
    projects = dispatch_explorer_index_projects(projects, now)

    # Make sure to consume the generator
    for _ in projects:
        pass


def dispatch_explorer_index_projects(
    all_projects: Generator[tuple[int, int]],
    timestamp: datetime,
) -> Generator[tuple[int, int]]:
    """
    Dispatch explorer indexing tasks for projects, batching them and spreading
    the load throughout the day using countdown delays.

    Args:
        all_projects: Generator of (project_id, organization_id) tuples
        timestamp: The timestamp when the dispatch started

    Yields:
        Each (project_id, organization_id) tuple as it's processed
    """
    batch: list[tuple[int, int]] = []
    count = 0

    for project_id, org_id in all_projects:
        batch.append((project_id, org_id))
        count += 1

        if len(batch) >= EXPLORER_INDEX_PROJECTS_PER_BATCH:
            run_explorer_index_for_projects.apply_async(
                args=[batch, timestamp.isoformat()],
                countdown=compute_delay(
                    timestamp,
                    (count - 1) // EXPLORER_INDEX_PROJECTS_PER_BATCH,
                    duration=EXPLORER_INDEX_RUN_FREQUENCY,
                    step=EXPLORER_INDEX_DISPATCH_STEP,
                ),
            )
            batch = []

        yield project_id, org_id

    # Dispatch remaining projects
    if batch:
        run_explorer_index_for_projects.apply_async(
            args=[batch, timestamp.isoformat()],
            countdown=compute_delay(
                timestamp,
                (count - 1) // EXPLORER_INDEX_PROJECTS_PER_BATCH,
                duration=EXPLORER_INDEX_RUN_FREQUENCY,
                step=EXPLORER_INDEX_DISPATCH_STEP,
            ),
        )


@instrumented_task(
    name="sentry.tasks.seer_explorer_index.run_explorer_index_for_projects",
    namespace=seer_tasks,
    processing_deadline_duration=60,
)
def run_explorer_index_for_projects(
    projects: list[tuple[int, int]], start: str, *args, **kwargs
) -> None:
    """
    Call the seer /v1/automation/explorer/index endpoint to schedule indexing tasks
    for a batch of projects.

    Args:
        projects: List of (project_id, organization_id) tuples
        start: ISO format timestamp string for when this batch was scheduled
    """
    if not options.get("seer.explorer_index.enable"):
        return

    if not projects:
        return

    # Build the request payload
    # The seer endpoint expects: {"projects": [{"org_id": int, "project_id": int}, ...]}
    project_list = [{"org_id": org_id, "project_id": project_id} for project_id, org_id in projects]

    payload = {"projects": project_list}
    body = orjson.dumps(payload)

    path = "/v1/automation/explorer/index"

    try:
        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}{path}",
            data=body,
            headers={
                "content-type": "application/json;charset=utf-8",
                **sign_with_seer_secret(body),
            },
            timeout=30,
        )
        response.raise_for_status()

        result = response.json()
        scheduled_count = result.get("scheduled_count", 0)

        logger.info(
            "Successfully scheduled explorer index tasks in seer",
            extra={
                "scheduled_count": scheduled_count,
                "requested_count": len(projects),
            },
        )

    except requests.RequestException as e:
        logger.exception(
            "Failed to schedule explorer index tasks in seer",
            extra={
                "num_projects": len(projects),
                "error": str(e),
            },
        )
        # Re-raise to let the task framework handle retry logic
        raise
