from __future__ import annotations

from typing import Any

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.workflow_engine.handlers.detector_outcome.base import DetectorOutcomeHandler
from sentry.workflow_engine.handlers.detector_outcome.supported_outcomes import (
    DetectorOutcome,
    detector_outcome_registry,
)
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.processors import DetectorEvaluation
from sentry.workflow_engine.tasks.seer_investigation import (
    create_detector_investigation,
    record_investigation,
)

# The detector config key naming the service account that creates investigations.
SERVICE_ACCOUNT_CONFIG_KEY = "service_account_id"


@detector_outcome_registry.add(DetectorOutcome.SEER_INVESTIGATION)
class SeerInvestigationOutcomeHandler(DetectorOutcomeHandler):
    """
    Start a Seer investigation for each occurrence instead of creating an issue.

    Pair it with a detector that persists `DetectorState` so each occurrence is a transition
    and replays are deduped. Status changes produce nothing, since investigations don't resolve.

    The detector commits its state before this runs, so the investigation is created by a
    retried task rather than inline: a failure here would otherwise be lost to dedupe.
    The task creates it as the existing service account in
    `detector.config["service_account_id"]`, which needs an investigation scope and access
    to the detector's project; occurrences are skipped, with a metric, when it can't be used.
    """

    def handle(self, detector: Detector, evaluation: DetectorEvaluation) -> None:
        occurrence = evaluation.result
        if not isinstance(occurrence, IssueOccurrence):
            return

        service_account_id = detector.config.get(SERVICE_ACCOUNT_CONFIG_KEY)
        if service_account_id is None:
            record_investigation("skipped", detector.type, reason="no_service_account")
            return

        create_detector_investigation.delay(
            detector_id=detector.id,
            service_account_id=service_account_id,
            title=occurrence.issue_title[:255],
            source=_investigation_source(detector, evaluation, occurrence),
        )


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
