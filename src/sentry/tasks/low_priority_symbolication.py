"""
Tasks that automate the job of moving projects in and out of symbolicator's low priority queue based
on symbolication metrics stored in Redis.

This has three major tasks, executed in the following general order:
1. Scan for new suspect projects in Redis that need to be checked for LPQ eligibility. Triggers 2 and 3.
2. Determine a project's eligibility for the LPQ based on their recorded metrics.
3. Remove some specified project from the LPQ.
"""

import logging
import time
from typing import Literal

import sentry_sdk
from django.conf import settings

from sentry import options
from sentry.killswitches import normalize_value
from sentry.processing import realtime_metrics
from sentry.processing.realtime_metrics.base import (
    BucketedCounts,
    BucketedDurationsHistograms,
    DurationsHistogram,
)
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics

logger = logging.getLogger(__name__)


@instrumented_task(  # type: ignore
    name="sentry.tasks.low_priority_symbolication.scan_for_suspect_projects",
    queue="symbolications.compute_low_priority_projects",
    ignore_result=True,
    soft_time_limit=10,
)
def scan_for_suspect_projects() -> None:
    """Scans and updates the list of projects assigned to the low priority queue."""
    try:
        _scan_for_suspect_projects()
    finally:
        _record_metrics()


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
        _report_change(project_id=project_id, change="removed", reason="no metrics")


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

    event_counts = realtime_metrics.get_counts_for_project(project_id, cutoff)
    durations = realtime_metrics.get_durations_for_project(project_id, cutoff)

    excessive_rate = excessive_event_rate(project_id, event_counts)
    excessive_duration = excessive_event_duration(project_id, durations)

    if excessive_rate or excessive_duration:
        was_added = realtime_metrics.add_project_to_lpq(project_id)
        if was_added:
            reason = "rate" if excessive_rate else "duration"
            if excessive_rate and excessive_duration:
                reason = "rate-duration"
            _report_change(project_id=project_id, change="added", reason=reason)
    else:
        was_removed = realtime_metrics.remove_projects_from_lpq({project_id})
        if was_removed:
            _report_change(project_id=project_id, change="removed", reason="ineligible")


def excessive_event_rate(project_id: int, event_counts: BucketedCounts) -> bool:
    """Whether the project is sending too many symbolication requests."""
    options = settings.SENTRY_LPQ_OPTIONS

    average_rate = event_counts.rate(event_counts.TOTAL_PERIOD)
    recent_rate = event_counts.rate(period=options["recent_event_period"])

    # Note, We had these tagged with tags={"project_id": project_id} during our initial
    # evaluation, however the cardinality for this is really too high to leave that on
    # forever in production.
    metrics.gauge("symbolication.lpq.computation.rate.total", average_rate)
    metrics.gauge("symbolication.lpq.computation.rate.recent", recent_rate)

    return bool(
        recent_rate > options["min_recent_event_rate"]
        and recent_rate > options["recent_event_multiple"] * average_rate
    )


def excessive_event_duration(project_id: int, durations: BucketedDurationsHistograms) -> bool:
    """Whether the project's symbolication requests are taking too long to process."""
    options = settings.SENTRY_LPQ_OPTIONS

    total_histogram = DurationsHistogram(bucket_size=durations.histograms[0].bucket_size)
    for histogram in durations.histograms:
        total_histogram.incr_from(histogram)

    try:
        p75_duration = total_histogram.percentile(0.75)
    except ValueError:
        return False
    events_per_minute = total_histogram.total_count() / (durations.total_time() / 60)

    # Note, We had these tagged with tags={"project_id": project_id} during our initial
    # evaluation, however the cardinality for this is really too high to leave that on
    # forever in production.
    metrics.gauge("symbolication.lpq.computation.durations.p75", p75_duration)
    metrics.gauge("symbolication.lpq.computation.durations.events_per_minutes", events_per_minute)

    return bool(
        events_per_minute > options["min_events_per_minute"]
        and p75_duration > options["min_p75_duration"]
    )


def _report_change(project_id: int, change: Literal["added", "removed"], reason: str) -> None:
    if not reason:
        reason = "unknown"

    if change == "added":
        message = "Added project to symbolicator's low priority queue"
    else:
        message = "Removed project from symbolicator's low priority queue"

    with sentry_sdk.push_scope() as scope:
        scope.set_level("warning")
        scope.set_tag("project", project_id)
        scope.set_tag("lpq_reason", reason)
        sentry_sdk.capture_message(message)


def _record_metrics() -> None:
    project_count = len(realtime_metrics.get_lpq_projects())
    metrics.gauge(
        "tasks.store.symbolicate_event.low_priority.projects.auto",
        project_count,
    )

    # The manual kill switch is a list of configurations where each config item corresponds to one
    # project affected by the switch. The general idea is to grab the raw option, validate its
    # contents, and then assume that the length of the validated list corresponds to the number of
    # projects in that switch.

    always_included_raw = options.get(
        "store.symbolicate-event-lpq-always",
    )
    always_included = len(
        normalize_value("store.symbolicate-event-lpq-always", always_included_raw)
    )
    metrics.gauge(
        "tasks.store.symbolicate_event.low_priority.projects.manual.always",
        always_included,
    )

    never_included_raw = options.get(
        "store.symbolicate-event-lpq-never",
    )
    never_included = len(normalize_value("store.symbolicate-event-lpq-never", never_included_raw))
    metrics.gauge(
        "tasks.store.symbolicate_event.low_priority.projects.manual.never",
        never_included,
    )
