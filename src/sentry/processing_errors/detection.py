from __future__ import annotations

import logging

from django.utils import timezone

from sentry import features, ratelimits
from sentry.processing_errors.grouptype import (
    SourcemapConfigurationType,
    SourcemapPacketValue,
    has_js_sourcemap_errors,
)
from sentry.processing_errors.provisioning import ensure_sourcemap_detector
from sentry.tasks.post_process import PostProcessJob
from sentry.utils import metrics
from sentry.workflow_engine.handlers.detector.stateful import get_redis_client
from sentry.workflow_engine.models import DataPacket, DetectorState
from sentry.workflow_engine.processors.detector import process_detectors

logger = logging.getLogger(__name__)

# How often (seconds) to refresh date_updated when the detector is already triggered.
# Must be much less than the staleness threshold used for resolution (PR 5).
REFRESH_INTERVAL_SECONDS = 5 * 60  # 5 minutes

# TTL for the Redis triggered cache. If Redis loses the key, we'll just
# fall through to the full evaluation path, which is safe.
TRIGGERED_CACHE_TTL_SECONDS = 60 * 60  # 1 hour


def _redis_key_triggered(project_id: int) -> str:
    return f"sourcemap_detector:triggered:{project_id}"


def _is_detector_triggered(project_id: int) -> bool:
    if get_redis_client().get(_redis_key_triggered(project_id)):
        return True

    # Cache miss — check the DB and backfill the cache if triggered
    is_triggered = DetectorState.objects.filter(
        detector__project_id=project_id,
        detector__type=SourcemapConfigurationType.slug,
        is_triggered=True,
    ).exists()

    if is_triggered:
        _set_detector_triggered(project_id)

    return is_triggered


def _set_detector_triggered(project_id: int) -> None:
    get_redis_client().set(_redis_key_triggered(project_id), "1", ex=TRIGGERED_CACHE_TTL_SECONDS)
    # Consume the first rate limit slot so the next refresh is throttled
    ratelimits.backend.is_limited(
        f"sourcemap_detector:refresh:{project_id}",
        limit=1,
        window=REFRESH_INTERVAL_SECONDS,
    )


def _maybe_refresh_date_updated(project_id: int) -> None:
    """
    When the detector is already triggered, periodically refresh
    DetectorState.date_updated so the resolution task knows the issue
    is still occurring. Rate-limited to at most once per
    REFRESH_INTERVAL_SECONDS per project.
    """
    if ratelimits.backend.is_limited(
        f"sourcemap_detector:refresh:{project_id}",
        limit=1,
        window=REFRESH_INTERVAL_SECONDS,
    ):
        return

    slug = SourcemapConfigurationType.slug
    rows = DetectorState.objects.filter(
        detector__project_id=project_id,
        detector__type=slug,
        is_triggered=True,
    ).update(date_updated=timezone.now())

    if rows:
        metrics.incr("processing_errors.sourcemap_detector.date_updated_refreshed")


def detect_sourcemap_issues(job: PostProcessJob) -> None:
    """
    Post-process pipeline step that detects sourcemap configuration issues
    from processing errors on ERROR events.
    """
    if job["is_reprocessed"]:
        return

    event = job["event"]

    if not features.has("organizations:sourcemap-issue-detection", event.project.organization):
        return

    errors = event.data.get("errors", [])
    # Filter out invalid (non-Mapping) entries from errors list before processing
    valid_errors = [e for e in errors if isinstance(e, dict)]
    if not has_js_sourcemap_errors(valid_errors):
        return

    metrics.incr("processing_errors.sourcemap_detector.event_with_js_errors")

    if _is_detector_triggered(event.project.id):
        _maybe_refresh_date_updated(event.project.id)
        return

    detector = ensure_sourcemap_detector(event.project)

    # Create a clean copy of event data with only valid errors to avoid downstream issues
    clean_event_data = dict(event.data)
    clean_event_data["errors"] = valid_errors

    packet = DataPacket(
        source_id=str(event.project.id),
        packet=SourcemapPacketValue(
            event_id=event.event_id,
            event_data=clean_event_data,
        ),
    )

    results = process_detectors(packet, [detector])

    for _detector, detector_results in results:
        for _group_key, result in detector_results.items():
            if result.is_triggered:
                _set_detector_triggered(event.project.id)
                metrics.incr("processing_errors.sourcemap_detector.triggered")
