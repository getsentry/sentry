from __future__ import annotations

import logging
from datetime import timedelta

from django.utils import timezone

from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import GroupStatus
from sentry.processing_errors.detection import _redis_key_triggered
from sentry.processing_errors.grouptype import SourcemapConfigurationType
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import workflow_engine_tasks
from sentry.utils import metrics
from sentry.workflow_engine.handlers.detector.stateful import (
    StatefulDetectorHandler,
    get_redis_client,
)
from sentry.workflow_engine.models import DetectorState
from sentry.workflow_engine.types import DetectorPriorityLevel

logger = logging.getLogger(__name__)

# Detectors with no new failures for this long are resolved.
# Must be >> REFRESH_INTERVAL_SECONDS (5 min) in detection.py.
STALENESS_THRESHOLD_MINUTES = 30

# Ignore rows older than this to avoid scanning unrelated data.
MAX_AGE_DAYS = 1


@instrumented_task(
    name="sentry.processing_errors.tasks.resolve_stale_sourcemap_detectors",
    namespace=workflow_engine_tasks,
    silo_mode=SiloMode.REGION,
)
def resolve_stale_sourcemap_detectors() -> None:
    """
    Periodic task that resolves sourcemap configuration detectors
    whose date_updated is older than the staleness threshold,
    indicating that the sourcemap issue is no longer occurring.
    """
    now = timezone.now()
    stale_states = DetectorState.objects.filter(
        detector__type=SourcemapConfigurationType.slug,
        is_triggered=True,
        date_updated__lt=now - timedelta(minutes=STALENESS_THRESHOLD_MINUTES),
        date_updated__gt=now - timedelta(days=MAX_AGE_DAYS),
    ).select_related("detector")

    for state in stale_states:
        _resolve_detector(state)


def _resolve_detector(state: DetectorState) -> None:
    """
    Atomically resolve a single triggered DetectorState and produce
    a StatusChangeMessage so the issue platform marks it resolved.
    """
    now = timezone.now()

    rows = DetectorState.objects.filter(
        id=state.id,
        is_triggered=True,
        date_updated__lt=now,
    ).update(
        is_triggered=False,
        state=DetectorPriorityLevel.OK,
        date_updated=now,
    )

    if not rows:
        return

    handler = state.detector.detector_handler
    if handler is None:
        logger.error("detector_handler returned None for detector %s", state.detector.id)
        return
    if not isinstance(handler, StatefulDetectorHandler):
        logger.error("Unexpected handler type %s for detector %s", type(handler), state.detector.id)
        return

    fingerprint = [
        *handler.build_issue_fingerprint(),
        handler.state_manager.build_key(None),
    ]

    status_change = StatusChangeMessage(
        fingerprint=fingerprint,
        project_id=state.detector.project_id,
        new_status=GroupStatus.RESOLVED,
        new_substatus=None,
        detector_id=state.detector.id,
    )

    produce_occurrence_to_kafka(
        payload_type=PayloadType.STATUS_CHANGE,
        status_change=status_change,
    )

    # Clear triggered cache so detection can re-trigger if the problem returns.
    # This is keyed per-project, so resolving any detector clears it for the project.
    get_redis_client().delete(_redis_key_triggered(state.detector.project_id))

    metrics.incr("processing_errors.sourcemap_detector.resolved")
