from __future__ import annotations

import logging
from collections.abc import Generator, Iterator
from datetime import datetime, timedelta

import orjson
import requests
import sentry_sdk
from django.conf import settings
from django.utils import timezone as django_timezone

from sentry import features, options
from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.seer.seer_setup import get_seer_org_acknowledgement
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.tasks.base import instrumented_task
from sentry.tasks.statistical_detectors import compute_delay
from sentry.taskworker.namespaces import seer_tasks
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger("sentry.tasks.seer_explorer_indexer")

LAST_RUN_CACHE_KEY = "seer:explorer_index:last_run"
LAST_RUN_CACHE_TIMEOUT = 24 * 60 * 60  # 24 hours

EXPLORER_INDEX_PROJECTS_PER_BATCH = 100
# Use a larger prime number to prevent thundering
EXPLORER_INDEX_DISPATCH_STEP = timedelta(seconds=37)

FEATURE_NAMES = ["organizations:gen-ai-features", "organizations:seer-explorer-index"]


def get_seer_explorer_enabled_projects() -> Generator[tuple[int, int]]:
    """
    Get all active projects that belong to organizations with seer-explorer enabled.

    Yields:
        Tuple of (project_id, organization_id)
    """
    projects = Project.objects.filter(status=ObjectStatus.ACTIVE).select_related("organization")
    current_hour = django_timezone.now().hour

    for project in RangeQuerySetWrapper(
        projects,
        result_value_getter=lambda p: p.id,
    ):
        if options.get("seer.explorer_index.killswitch.enable"):
            logger.info("seer.explorer_index.killswitch.enable flag enabled, skipping")
            return

        if not project.flags.has_transactions:
            continue

        if project.id % 23 != current_hour:
            continue

        with sentry_sdk.start_span(op="seer_explorer_index.has_feature"):
            batch_result = features.batch_has(FEATURE_NAMES, organization=project.organization)

            if batch_result:
                org_key = f"organization:{project.organization.id}"
                has_all_features = all(
                    batch_result.get(org_key, {}).get(feature_name, False)
                    for feature_name in FEATURE_NAMES
                )
            else:
                has_all_features = all(
                    features.has(name, project.organization) for name in FEATURE_NAMES
                )

            has_feature = (
                has_all_features
                and not bool(project.organization.get_option("sentry:hide_ai_features"))
                and get_seer_org_acknowledgement(project.organization)
            )

        if has_feature:
            yield project.id, project.organization_id


@instrumented_task(
    name="sentry.tasks.seer_explorer_index.schedule_explorer_index",
    namespace=seer_tasks,
    processing_deadline_duration=10 * 60,
)
def schedule_explorer_index() -> None:
    """
    Main periodic task that runs daily to schedule explorer indexing for active projects
    in seer-enabled organizations. Spreads the load throughout the day.
    """
    logger.info("Started schedule_explorer_index task")

    if not options.get("seer.explorer_index.enable"):
        logger.info("seer.explorer_index.enable flag is disabled")
        return

    now = django_timezone.now()

    projects = get_seer_explorer_enabled_projects()
    projects = dispatch_explorer_index_projects(projects, now)

    # Make sure to consume the generator
    scheduled_count = 0
    for _ in projects:
        scheduled_count += 1

    logger.info(
        "Successfully scheduled explorer index jobs for valid projects",
        extra={
            "scheduled_count": scheduled_count,
        },
    )


def dispatch_explorer_index_projects(
    all_projects: Iterator[tuple[int, int]],
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

    explorer_index_run_frequency = timedelta(hours=1)

    for project_id, org_id in all_projects:
        batch.append((project_id, org_id))
        count += 1

        if len(batch) >= EXPLORER_INDEX_PROJECTS_PER_BATCH:
            run_explorer_index_for_projects.apply_async(
                args=[batch, timestamp.isoformat()],
                countdown=compute_delay(
                    timestamp,
                    (count - 1) // EXPLORER_INDEX_PROJECTS_PER_BATCH,
                    duration=explorer_index_run_frequency,
                    step=EXPLORER_INDEX_DISPATCH_STEP,
                ),
            )
            logger.info("Successfully dispatched run_explorer_index_for_projects tasks in sentry")
            batch = []

        yield project_id, org_id

    if batch:
        run_explorer_index_for_projects.apply_async(
            args=[batch, timestamp.isoformat()],
            countdown=compute_delay(
                timestamp,
                (count - 1) // EXPLORER_INDEX_PROJECTS_PER_BATCH,
                duration=explorer_index_run_frequency,
                step=EXPLORER_INDEX_DISPATCH_STEP,
            ),
        )
        logger.info("Successfully dispatched run_explorer_index_for_projects tasks in sentry")


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
    except requests.RequestException as e:
        logger.exception(
            "Failed to schedule explorer index tasks in seer",
            extra={
                "num_projects": len(projects),
                "error": str(e),
            },
        )
        raise

    result = response.json()
    scheduled_count = result.get("scheduled_count", 0)

    logger.info(
        "Successfully scheduled explorer index tasks in seer",
        extra={
            "scheduled_count": scheduled_count,
            "requested_count": len(projects),
        },
    )
