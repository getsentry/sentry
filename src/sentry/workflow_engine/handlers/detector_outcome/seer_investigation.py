from __future__ import annotations

import logging
from typing import Any

from rest_framework.exceptions import PermissionDenied

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.utils import metrics
from sentry.viewer_context import ActorId, ActorType
from sentry.workflow_engine.handlers.detector_outcome.base import DetectorOutcomeHandler
from sentry.workflow_engine.handlers.detector_outcome.supported_outcomes import (
    DetectorOutcome,
    detector_outcome_registry,
)
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.processors import DetectorEvaluation

logger = logging.getLogger(__name__)

# The detector config key naming the service account that creates investigations.
SERVICE_ACCOUNT_CONFIG_KEY = "service_account_id"


@detector_outcome_registry.add(DetectorOutcome.SEER_INVESTIGATION)
class SeerInvestigationOutcomeHandler(DetectorOutcomeHandler):
    """
    Start a Seer investigation for each occurrence instead of creating an issue.

    Pair it with a detector that persists `DetectorState` so each occurrence is a transition
    and replays are deduped. Status changes produce nothing, since investigations don't resolve.

    The investigation is created by the existing service account in
    `detector.config["service_account_id"]`. It needs an investigation scope and access to
    the detector's project; occurrences are skipped, with a metric, when it can't be used.
    """

    def handle(self, detector: Detector, evaluation: DetectorEvaluation) -> None:
        occurrence = evaluation.result
        if not isinstance(occurrence, IssueOccurrence):
            return

        service_account_id = detector.config.get(SERVICE_ACCOUNT_CONFIG_KEY)
        if service_account_id is None:
            _record("skipped", detector, reason="no_service_account")
            return

        # Imported here: investigations depend on workflow engine models.
        from sentry.investigations.services import create_agentic_manual_investigation
        from sentry.notebooks.services.notebooks import NotebookValidationError

        project = detector.linked_project
        try:
            create_agentic_manual_investigation(
                organization=project.organization,
                creator=ActorId(ActorType.SERVICE_ACCOUNT, service_account_id),
                title=occurrence.issue_title[:255],
                source=_investigation_source(detector, evaluation, occurrence),
                project_ids=[project.id],
                filters={},
            )
        except (PermissionDenied, NotebookValidationError):
            logger.exception(
                "workflow_engine.seer_investigation.creator_rejected",
                extra={"detector_id": detector.id, "service_account_id": service_account_id},
            )
            _record("skipped", detector, reason="creator_rejected")
            return
        _record("started", detector)


def _record(outcome: str, detector: Detector, *, reason: str | None = None) -> None:
    tags = {"detector_type": detector.type}
    if reason is not None:
        tags["reason"] = reason
    metrics.incr(f"workflow_engine.seer_investigation.{outcome}", tags=tags, sample_rate=1)


def _investigation_source(
    detector: Detector, evaluation: DetectorEvaluation, occurrence: IssueOccurrence
) -> dict[str, Any]:
    event_data = evaluation.data.get("event_data") or {}
    environment = event_data.get("environment")
    detected = f"Detected at {occurrence.detection_time.isoformat()}"
    if environment:
        detected += f" in the {environment} environment"
    lines = [occurrence.issue_title, occurrence.subtitle, f"{detected}."]
    lines.extend(f"{evidence.name}: {evidence.value}" for evidence in occurrence.evidence_display)
    lines.append("Decide whether this needs action and, if it does, find the cause.")
    return {
        "type": "manual",
        "prompt": "\n".join(line for line in lines if line),
        "seed": {
            "detectorId": detector.id,
            "detectorType": detector.type,
            "occurrenceId": occurrence.id,
            "evidence": occurrence.evidence_data,
        },
    }
