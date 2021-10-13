"""
Tasks that automate the job of moving projects in and out of symbolicator's low priority queue based
on symbolication metrics stored in Redis.

This has three major tasks, executed in the following general order:
1. Scan for new suspect projects in Redis that need to be checked for LPQ eligibility. Triggers 2 and 3.
2. Determine a project's eligibility for the LPQ based on their recorded metrics.
3. Remove some specified project from the LPQ.
"""

import collections
import logging
import time
from typing import Deque, Dict, Iterable

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
    now = int(time.time())

    for project_id in realtime_metrics.projects():
        suspect_projects.add(project_id)
        update_lpq_eligibility.delay(project_id=project_id, cutoff=now)

    # Prune projects we definitely know shouldn't be in the queue any more.
    # `update_lpq_eligibility` should handle removing suspect projects from the list if it turns
    # out they need to be evicted.
    current_lpq_projects = realtime_metrics.get_lpq_projects() or set()
    expired_projects = current_lpq_projects.difference(suspect_projects)
    if not expired_projects:
        return

    realtime_metrics.remove_projects_from_lpq(expired_projects)

    for project_id in expired_projects:
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
    ################################################################
    # The rate metrics: compare the average rate of the entire time window with the average
    # rate of the last minute.

    # We need somewhere to keep the recent buckets to compute the rate at.  We only get an
    # iterator as input so keep the last few buckets seen, once the iterator is exhausted
    # this will have the most recent buckets.
    recent_bucket_count = 60 / realtime_metrics.realtime_metrics_store._counter_bucket_size
    recent_buckets: Deque[BucketedCount] = collections.deque(maxlen=recent_bucket_count)

    # We need to know the average rate over the total time period.
    total_count = 0
    total_time = 0

    # Calculate total rate
    for bucket in invocations:
        recent_buckets.append(bucket)
        total_count += bucket.count
        total_time += realtime_metrics.realtime_metrics_store._counter_bucket_size
    total_rate = total_count / total_time

    # Calculate recent rate
    recent_count = sum(bucket.count for bucket in recent_buckets)
    recent_time = recent_bucket_count * realtime_metrics.realtime_metrics_store._counter_bucket_size
    recent_rate = recent_count / recent_time

    if recent_rate > 50 and recent_rate > 5 * total_rate:
        return True

    ################################################################
    # The duration metrics: compute p75 and compare with an absolute value.

    total_histogram: Dict[int, int] = collections.defaultdict(lambda: 0)
    total_count = 0
    for duration_bucket in durations:
        for duration, count in duration_bucket.histogram.items():
            total_histogram[duration] += count
            total_count += count
    p75_count = int(0.75 * total_count)

    counter = 0
    for duration in sorted(total_histogram.keys()):
        counter += total_histogram[duration]
        if counter >= p75_count:
            p75_duration = duration

    events_per_minute = counter / realtime_metrics.realtime_metrics_store._duration_time_window / 60

    if events_per_minute > 15 and p75_duration > 6 * 60:
        return True

    return False
