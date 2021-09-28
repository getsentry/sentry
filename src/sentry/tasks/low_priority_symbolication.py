"""
Tasks that automate the job of moving projects in and out of symbolicator's low priority queue based
on symbolication metrics stored in Redis.

This has three major tasks, executed in the following general order:
1. Scan for new suspect projects in Redis that need to be checked for LPQ eligibility. Triggers 2 and 3.
2. Determine a project's eligibility for the LPQ based on their recorded metrics.
3. Remove some specified project from the LPQ.
"""

import logging

import sentry_sdk

from sentry.processing.realtime_metrics import realtime_metrics_store
from sentry.processing.realtime_metrics.base import BucketedCount
from sentry.tasks.base import instrumented_task

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.symbolicator.scan_for_suspect_projects",
    queue="symbolications.compute_low_priority_projects",
    ignore_result=True,
    soft_time_limit=10,
)  # type: ignore
def scan_for_suspect_projects() -> None:
    _scan_for_suspect_projects()


def _scan_for_suspect_projects() -> None:
    suspect_projects = set([])
    for project_id in realtime_metrics_store.get_lpq_candidates():
        suspect_projects.add(project_id)
        compute_lpq_eligibility(project_id)

    current_lpq_projects = realtime_metrics_store.get_lpq_projects() or set([])
    deleted_projects = current_lpq_projects.difference(suspect_projects)

    if len(deleted_projects) == 0:
        return

    removed = realtime_metrics_store.remove_projects_from_lpq(deleted_projects)

    # TODO: should this just be logger.warning(...)?
    if len(removed) > 0:
        sentry_sdk.capture_message(
            f"Moved project(s) {removed} out of symbolicator's low priority queue.", level="info"
        )

    not_removed = deleted_projects.difference(removed)
    if len(not_removed) > 0:
        # TODO: should this just be logger.exception(...) or just raising an exception?
        sentry_sdk.capture_message(
            f"Failed to move project(s) {removed} out of symbolicator's low priority queue.",
            level="error",
        )


@instrumented_task(
    name="sentry.tasks.symbolicator.compute_lpq_eligibility",
    queue="symbolications.compute_low_priority_projects",
    ignore_result=True,
    soft_time_limit=10,
)  # type: ignore
def compute_lpq_eligibility(project_id: int) -> None:
    _compute_lpq_eligibility(project_id)


def _compute_lpq_eligibility(project_id: int) -> None:
    bucketed_counts = realtime_metrics_store.get_bucketed_counts_for_project(project_id)

    is_eligible = calculation_magic(bucketed_counts)

    if not is_eligible:
        return

    realtime_metrics_store.add_project_to_lpq(project_id)
    # TODO: should this just be logger.warning(...)?
    sentry_sdk.capture_message(
        f"Moved project {project_id} to symbolicator's low priority queue.", level="warning"
    )


def calculation_magic(timestamps: BucketedCount) -> bool:
    return False
