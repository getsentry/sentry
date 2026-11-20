import logging
from typing import Any

from rest_framework.exceptions import PermissionDenied
from taskbroker_client.retry import Retry

from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import workflow_engine_tasks
from sentry.utils import metrics
from sentry.viewer_context import ActorId, ActorType
from sentry.workflow_engine.models import Detector

logger = logging.getLogger(__name__)


def record_investigation(outcome: str, detector_type: str, *, reason: str | None = None) -> None:
    tags = {"detector_type": detector_type}
    if reason is not None:
        tags["reason"] = reason
    metrics.incr(f"workflow_engine.seer_investigation.{outcome}", tags=tags, sample_rate=1)


@instrumented_task(
    name="sentry.workflow_engine.tasks.seer_investigation.create_detector_investigation",
    namespace=workflow_engine_tasks,
    processing_deadline_duration=60,
    retry=Retry(times=3, delay=30, on=(Exception,)),
    silo_mode=SiloMode.CELL,
)
def create_detector_investigation(
    detector_id: int, service_account_id: int, title: str, source: dict[str, Any]
) -> None:
    """Start the Seer investigation for a detector trigger.

    The detector has already committed its state, so a transient failure must retry here
    rather than be lost. A rejected service account can't succeed on retry and is skipped.
    """
    # Imported here: investigations depend on workflow engine models.
    from sentry.investigations.services import create_agentic_manual_investigation
    from sentry.notebooks.services.notebooks import NotebookValidationError

    detector = Detector.objects.select_related("project__organization").get_or_none(id=detector_id)
    if detector is None or detector.project is None:
        metrics.incr(
            "workflow_engine.seer_investigation.skipped",
            tags={"reason": "detector_missing"},
            sample_rate=1,
        )
        return

    project = detector.project
    try:
        create_agentic_manual_investigation(
            organization=project.organization,
            creator=ActorId(ActorType.SERVICE_ACCOUNT, service_account_id),
            title=title,
            source=source,
            project_ids=[project.id],
            filters={},
        )
    except (PermissionDenied, NotebookValidationError):
        logger.exception(
            "workflow_engine.seer_investigation.creator_rejected",
            extra={"detector_id": detector.id, "service_account_id": service_account_id},
        )
        record_investigation("skipped", detector.type, reason="creator_rejected")
        return
    record_investigation("started", detector.type)
