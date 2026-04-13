from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from django.core.cache import cache
from django.utils import timezone

from sentry import features, ratelimits
from sentry.issues.grouptype import GroupType
from sentry.processing_errors.grouptype import (
    ProcessingErrorDetectorHandler,
    ProcessingErrorPacketValue,
    SourcemapConfigurationType,
)
from sentry.processing_errors.provisioning import ensure_detector
from sentry.tasks.post_process import PostProcessJob
from sentry.utils import metrics
from sentry.workflow_engine.models import DataPacket, DetectorState
from sentry.workflow_engine.processors.detector import process_detectors

logger = logging.getLogger(__name__)

# How often (seconds) to refresh date_updated when the detector is already triggered.
# Must be much less than the staleness threshold used for resolution.
REFRESH_INTERVAL_SECONDS = 5 * 60  # 5 minutes

# TTL for the triggered cache. If the cache loses the key, we'll just
# fall through to the full evaluation path, which is safe.
TRIGGERED_CACHE_TTL_SECONDS = 60 * 60  # 1 hour


@dataclass(frozen=True)
class DetectorConfig:
    """Configuration for a processing error detector type."""

    config_type: type[GroupType]
    feature_flag: str | None = None

    def __post_init__(self) -> None:
        settings = self.config_type.detector_settings
        assert settings is not None, f"{self.config_type.slug} has no detector_settings"
        handler = settings.handler
        assert handler is not None, f"{self.config_type.slug} has no handler"
        assert issubclass(handler, ProcessingErrorDetectorHandler), (
            f"{self.config_type.slug} handler must be a ProcessingErrorDetectorHandler"
        )

    @property
    def slug(self) -> str:
        return self.config_type.slug

    @property
    def handler_cls(self) -> type[ProcessingErrorDetectorHandler]:
        settings = self.config_type.detector_settings
        assert settings is not None
        handler = settings.handler
        assert handler is not None and issubclass(handler, ProcessingErrorDetectorHandler)
        return handler


DETECTOR_CONFIGS: list[DetectorConfig] = [
    DetectorConfig(
        config_type=SourcemapConfigurationType,
        feature_flag="organizations:sourcemap-issue-detection",
    ),
]


def _cache_key_triggered(slug: str, project_id: int) -> str:
    return f"pe:{slug}:triggered:{project_id}"


def _is_detector_triggered(config: DetectorConfig, project_id: int) -> bool:
    key = _cache_key_triggered(config.slug, project_id)
    if cache.get(key):
        return True

    # Cache miss — check the DB and backfill the cache if triggered
    is_triggered = DetectorState.objects.filter(
        detector__project_id=project_id,
        detector__type=config.slug,
        is_triggered=True,
    ).exists()

    if is_triggered:
        _set_detector_triggered(config, project_id)

    return is_triggered


def _set_detector_triggered(config: DetectorConfig, project_id: int) -> None:
    cache.set(_cache_key_triggered(config.slug, project_id), True, TRIGGERED_CACHE_TTL_SECONDS)
    # Consume the first rate limit slot so the next refresh is throttled
    ratelimits.backend.is_limited(
        f"{config.slug}:refresh:{project_id}",
        limit=1,
        window=REFRESH_INTERVAL_SECONDS,
    )


def _maybe_refresh_date_updated(config: DetectorConfig, project_id: int) -> None:
    """
    When the detector is already triggered, periodically refresh
    DetectorState.date_updated so the resolution task knows the issue
    is still occurring. Rate-limited to at most once per
    REFRESH_INTERVAL_SECONDS per project.
    """
    if ratelimits.backend.is_limited(
        f"{config.slug}:refresh:{project_id}",
        limit=1,
        window=REFRESH_INTERVAL_SECONDS,
    ):
        return

    rows = DetectorState.objects.filter(
        detector__project_id=project_id,
        detector__type=config.slug,
        is_triggered=True,
    ).update(date_updated=timezone.now())

    if rows:
        metrics.incr(f"processing_errors.{config.slug}.date_updated_refreshed")


def _detect_for_config(
    event: Any,
    errors: Sequence[Mapping[str, Any]],
    config: DetectorConfig,
) -> None:
    if config.feature_flag and not features.has(config.feature_flag, event.project.organization):
        return

    if not any(e.get("type") in config.handler_cls.error_types for e in errors):
        return

    metrics.incr(f"processing_errors.{config.slug}.event_with_errors")

    project_id = event.project.id

    if _is_detector_triggered(config, project_id):
        _maybe_refresh_date_updated(config, project_id)
        return

    detector = ensure_detector(event.project, config.config_type)

    packet = DataPacket(
        source_id=str(project_id),
        packet=ProcessingErrorPacketValue(
            event_id=event.event_id,
            event_data=event.data,
        ),
    )

    results = process_detectors(packet, [detector])

    for _detector, detector_results in results:
        for _group_key, result in detector_results.items():
            if result.is_triggered:
                _set_detector_triggered(config, project_id)
                metrics.incr(f"processing_errors.{config.slug}.triggered")
                error_types = sorted(
                    config.handler_cls.error_types.intersection(
                        filter(None, (e.get("type") for e in errors))
                    )
                )
                logger.info(
                    "processing_errors.%s.occurrence_created",
                    config.slug,
                    extra={
                        "organization_slug": event.project.organization.slug,
                        "project_id": project_id,
                        "error_types": error_types,
                    },
                )


def detect_processing_issues(job: PostProcessJob) -> None:
    """
    Post-process pipeline step that detects processing error configuration
    issues from errors on events.
    """
    if job["is_reprocessed"]:
        return

    event = job["event"]
    errors = event.data.get("errors", [])
    if not errors:
        return

    for config in DETECTOR_CONFIGS:
        _detect_for_config(event, errors, config)
