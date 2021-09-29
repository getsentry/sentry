"""
Tasks that automate the job of moving projects in and out of symbolicator's low priority queue based
on symbolication metrics stored in Redis.

This has three major tasks, executed in the following general order:
1. Scan for new suspect projects in Redis that need to be checked for LPQ eligibility. Triggers 2 and 3.
2. Determine a project's eligibility for the LPQ based on their recorded metrics.
3. Remove some specified project from the LPQ.
"""

import logging

from sentry.processing.realtime_metrics import realtime_metrics_store
from sentry.processing.realtime_metrics.base import BucketedCount, DurationHistogram
from sentry.tasks.base import instrumented_task

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.symbolicator.scan_for_suspect_projects",
    queue="symbolications.compute_low_priority_projects",
    ignore_result=True,
    soft_time_limit=10,
)  # type: ignore
def scan_for_suspect_projects() -> None:
    """Scans and updates the list of projects assigned to the low priority queue."""
    _scan_for_suspect_projects()


def _scan_for_suspect_projects() -> None:
    suspect_projects = set([])

    for project_id in realtime_metrics_store.projects():
        suspect_projects.add(project_id)
        compute_lpq_eligibility(project_id).apply_async()

    # Prune projects we definitely know shouldn't be in the queue any more.
    # `compute_lpq_eligibility` should handle removing suspect projects from the list if it turns
    # out they need to be evicted.
    current_lpq_projects = realtime_metrics_store.get_lpq_projects() or set([])
    deleted_projects = current_lpq_projects.difference(suspect_projects)
    if len(deleted_projects) == 0:
        return

    removed = realtime_metrics_store.remove_projects_from_lpq(deleted_projects)

    if len(removed) > 0:
        for project_id in removed:
            logger.warning("Moved project out of symbolicator's low priority queue: %s", project_id)

    not_removed = deleted_projects.difference(removed)
    if len(not_removed) > 0:
        logger.warning(
            "Failed to move project(s) out of symbolicator's low priority queue: %s", not_removed
        )


@instrumented_task(
    name="sentry.tasks.symbolicator.compute_lpq_eligibility",
    queue="symbolications.compute_low_priority_projects",
    ignore_result=True,
    soft_time_limit=10,
)  # type: ignore
def compute_lpq_eligibility(project_id: int) -> None:
    """
    Given a project ID, determines whether the project belongs in the low priority queue and
    removes or assigns it accordingly to the low priority queue.
    """
    _compute_lpq_eligibility(project_id)


def _compute_lpq_eligibility(project_id: int) -> None:
    counts = realtime_metrics_store.get_counts_for_project(project_id)
    durations = realtime_metrics_store.get_durations_for_project(project_id)

    is_eligible = calculation_magic(counts, durations)

    if is_eligible:
        was_added = realtime_metrics_store.add_project_to_lpq(project_id)
        if was_added:
            logger.warning("Moved project to symbolicator's low priority queue: %s", project_id)
    elif not is_eligible:
        was_removed = realtime_metrics_store.remove_project_from_lpq(project_id)
        if was_removed:
            logger.warning("Moved project out of symbolicator's low priority queue: %s", project_id)


def calculation_magic(invocations: BucketedCount, durations: DurationHistogram) -> bool:
    return False
