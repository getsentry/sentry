"""
Tasks that automate the job of moving projects in and out of symbolicator's low priority queue based
on symbolication metrics stored in Redis.

This has three major tasks, executed in the following general order:
1. Scan for new suspect projects in Redis that need to be checked for LPQ eligibility. Triggers 2 and 3.
2. Determine a project's eligibility for the LPQ based on their recorded metrics.
3. Remove some specified project from the LPQ.
"""

import logging
from typing import Iterable

from sentry.processing.realtime_metrics import realtime_metrics_store
from sentry.tasks.base import instrumented_task

logger = logging.getLogger(__name__)


@instrumented_task(name="sentry.tasks.symbolicator.scan_for_suspect_projects", queue="symbolicator.compute_low_priority_queue", ignore_result=True)  # type: ignore
def scan_for_suspect_projects() -> None:
    _scan_for_suspect_projects()


def _scan_for_suspect_projects() -> None:
    suspect_projects = set([])
    for project_id in realtime_metrics_store.get_lpq_candidates():
        suspect_projects.add(project_id)
        calculate_lpq_eligibility(project_id)

    current_lpq_projects = realtime_metrics_store.get_lpq_projects() or set([])
    deleted_projects = current_lpq_projects.difference(suspect_projects)

    if len(deleted_projects) > 0:
        realtime_metrics_store.remove_projects_from_lpq(deleted_projects)


@instrumented_task(name="sentry.tasks.symbolicator.calculate_lpq_eligibility", queue="symbolicator.compute_low_priority_queue", ignore_result=True)  # type: ignore
def calculate_lpq_eligibility(project_id: int) -> None:
    _calculate_lpq_eligibility(project_id)


def _calculate_lpq_eligibility(project_id: int) -> None:
    bucketed_counts = realtime_metrics_store.get_bucketed_counts_for_project(project_id)

    is_eligible = calculation_magic(bucketed_counts)

    if not is_eligible:
        return

    # TODO: should this layer report to sentry or the store itself should report to sentry?
    realtime_metrics_store.add_project_to_lpq(project_id)


def calculation_magic(timestamps: Iterable[(int, int)]) -> bool:
    return False
