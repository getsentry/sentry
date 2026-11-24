import logging
from enum import StrEnum
from typing import Any

from rest_framework.exceptions import PermissionDenied
from taskbroker_client.retry import Retry

from sentry.constants import ObjectStatus
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import workflow_engine_tasks
from sentry.utils import metrics
from sentry.viewer_context import ActorId, ActorType
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.types import DetectorId

logger = logging.getLogger(__name__)


class SkipReason(StrEnum):
    NO_SERVICE_ACCOUNT = "no_service_account"
    DETECTOR_MISSING = "detector_missing"
    PROJECT_INACTIVE = "project_inactive"
    CREATOR_REJECTED = "creator_rejected"
    ALREADY_INVESTIGATING = "already_investigating"


def record_investigation_started(detector_type: str) -> None:
    metrics.incr(
        "workflow_engine.seer_investigation.started",
        tags={"detector_type": detector_type},
        sample_rate=1,
    )


def record_investigation_skipped(detector_type: str, reason: SkipReason) -> None:
    metrics.incr(
        "workflow_engine.seer_investigation.skipped",
        tags={"detector_type": detector_type, "reason": reason},
        sample_rate=1,
    )


@instrumented_task(
    name="sentry.workflow_engine.tasks.seer_investigation.create_detector_investigation",
    namespace=workflow_engine_tasks,
    processing_deadline_duration=60,
    retry=Retry(times=3, delay=30, on=(Exception,)),
    silo_mode=SiloMode.CELL,
)
def create_detector_investigation(
    detector_id: DetectorId,
    detector_type: str,
    service_account_id: int,
    title: str,
    source: dict[str, Any],
    fingerprint: list[str],
) -> None:
    """
    Start the Seer investigation for a detector trigger.

    The detector has already committed its state, so a transient failure must retry here
    rather than be lost. Creation is keyed on the occurrence fingerprint, so a retry or a
    priority change within the same issue group reuses the active investigation.

    A rejected service account can't succeed on retry and is skipped.
    """
    from sentry.investigations.services import create_agentic_detector_investigation
    from sentry.notebooks.services.notebooks import (
        MAX_NOTEBOOK_TITLE_LENGTH,
        NotebookValidationError,
    )

    detector = Detector.objects.select_related("project__organization").get_or_none(
        id=detector_id, project__isnull=False
    )
    if detector is None:
        record_investigation_skipped(detector_type, SkipReason.DETECTOR_MISSING)
        return

    project = detector.linked_project
    if project.status != ObjectStatus.ACTIVE:
        record_investigation_skipped(detector_type, SkipReason.PROJECT_INACTIVE)
        return

    try:
        _, created = create_agentic_detector_investigation(
            organization=project.organization,
            creator=ActorId(ActorType.SERVICE_ACCOUNT, service_account_id),
            title=title[:MAX_NOTEBOOK_TITLE_LENGTH],
            source=source,
            detector_id=detector.id,
            fingerprint=fingerprint,
            project_ids=[project.id],
        )

    except (PermissionDenied, NotebookValidationError) as error:
        # An expected configuration state, not a bug: the account was disabled, lost its
        # investigation scope, or can't reach the project.
        logger.warning(
            "workflow_engine.seer_investigation.creator_rejected",
            extra={
                "detector_id": detector.id,
                "service_account_id": service_account_id,
                "error": type(error).__name__,
            },
        )
        record_investigation_skipped(detector_type, SkipReason.CREATOR_REJECTED)
        return

    if not created:
        record_investigation_skipped(detector_type, SkipReason.ALREADY_INVESTIGATING)
        return

    record_investigation_started(detector_type)
