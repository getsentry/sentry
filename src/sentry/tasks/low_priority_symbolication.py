"""
Tasks that automate the job of moving projects in and out of symbolicator's low priority queue based
on symbolication metrics stored in Redis.

This has three major tasks, executed in the following general order:
1. Scan for new suspect projects in Redis that need to be checked for LPQ eligibility. Triggers 2 and 3.
2. Determine a project's eligibility for the LPQ based on their recorded metrics.
3. Remove some specified project from the LPQ.
"""

import datetime
import logging
from typing import Iterable

import pytz

from sentry.processing import realtime_metrics
from sentry.processing.realtime_metrics.base import BucketedCount, DurationHistogram
from sentry.tasks.base import instrumented_task

logger = logging.getLogger(__name__)


@instrumented_task(  # type: ignore
    name="sentry.tasks.low_priority_symbolication.scan_for_suspect_projects",
    queue="symbolications.compute_low_priority_projects",
    ignore_result=True,
    soft_time_limit=10,
)
def scan_for_suspect_projects() -> None:
    """Scans and updates the list of projects assigned to the low priority queue."""
    _scan_for_suspect_projects()


def _scan_for_suspect_projects() -> None:
    suspect_projects = set()
    now = int(datetime.datetime.now(tz=pytz.utc).timestamp())

    for project_id in realtime_metrics.projects():
        suspect_projects.add(project_id)
        update_lpq_eligibility.apply_async(project_id=project_id, cutoff=now)

    # Prune projects we definitely know shouldn't be in the queue any more.
    # `update_lpq_eligibility` should handle removing suspect projects from the list if it turns
    # out they need to be evicted.
    current_lpq_projects = realtime_metrics.get_lpq_projects() or set()
    deleted_projects = current_lpq_projects.difference(suspect_projects)
    if len(deleted_projects) == 0:
        return

    realtime_metrics.remove_projects_from_lpq(deleted_projects)

    for project_id in deleted_projects:
        # TODO: add metrics!
        logger.warning("Moved project out of symbolicator's low priority queue: %s", project_id)


@instrumented_task(  # type: ignore
    name="sentry.tasks.low_priority_symbolication.update_lpq_eligibility",
    queue="symbolications.compute_low_priority_projects",
    ignore_result=True,
    soft_time_limit=10,
)
def update_lpq_eligibility(project_id: int, cutoff: int) -> None:
    """
    Given a project ID, determines whether the project belongs in the low priority queue and
    removes or assigns it accordingly to the low priority queue.

    `cutoff` is a posix timestamp that specifies an end time for the historical data this method
    should consider when calculating a project's eligibility. In other words, only data recorded
    before `cutoff` should be considered.
    """
    _update_lpq_eligibility(project_id, cutoff)


def _update_lpq_eligibility(project_id: int, cutoff: int) -> None:
    # TODO: It may be a good idea to figure out how to debounce especially if this is
    # executing more than 10s after cutoff.
    counts = realtime_metrics.get_counts_for_project(project_id, cutoff)
    durations = realtime_metrics.get_durations_for_project(project_id, cutoff)

    is_eligible = calculation_magic(counts, durations)

    if is_eligible:
        was_added = realtime_metrics.add_project_to_lpq(project_id)
        if was_added:
            logger.warning("Moved project to symbolicator's low priority queue: %s", project_id)
    elif not is_eligible:
        was_removed = realtime_metrics.remove_projects_from_lpq({project_id})
        if was_removed:
            logger.warning("Moved project out of symbolicator's low priority queue: %s", project_id)


def calculation_magic(
    invocations: Iterable[BucketedCount], durations: Iterable[DurationHistogram]
) -> bool:
    return False
