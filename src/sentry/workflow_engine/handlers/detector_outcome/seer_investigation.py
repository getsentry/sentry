from __future__ import annotations

from typing import Any

from sentry.notebooks.models import NotebookSourceType
from sentry.workflow_engine.handlers.detector_outcome.base import DetectorOutcomeHandler
from sentry.workflow_engine.handlers.detector_outcome.supported_outcomes import (
    DetectorOutcome,
    detector_outcome_registry,
)
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.processors import DetectorEvaluation
from sentry.workflow_engine.tasks.seer_investigation import (
    SkipReason,
    create_detector_investigation,
    record_investigation_skipped,
)
from sentry.workflow_engine.types import DetectorInvestigation

# The detector config key naming the service account that creates investigations.
SERVICE_ACCOUNT_CONFIG_KEY = "service_account_id"


@detector_outcome_registry.add(DetectorOutcome.SEER_INVESTIGATION)
class SeerInvestigationOutcomeHandler(DetectorOutcomeHandler):
    """
    Start a Seer investigation for each `DetectorInvestigation` result. No issue is created.

    Each result is one detector trigger, identified by its `id`, so it gets its own
    investigation and task retries for it reuse that one. Other results produce nothing,
    since investigations don't resolve.

    The detector commits its state before this runs, so the investigation is created by a
    retried task rather than inline: a failure here would otherwise be lost to dedupe.
    The task creates it as the existing service account in
    `detector.config["service_account_id"]`, which needs an investigation scope and access
    to the detector's project; investigations are skipped, with a metric, when it can't be used.
    """

    def handle(self, detector: Detector, evaluation: DetectorEvaluation) -> None:
        investigation = evaluation.result
        if not isinstance(investigation, DetectorInvestigation):
            return

        service_account_id = detector.config.get(SERVICE_ACCOUNT_CONFIG_KEY)
        if service_account_id is None:
            record_investigation_skipped(detector.type, SkipReason.NO_SERVICE_ACCOUNT)
            return

        create_detector_investigation.delay(
            detector_id=detector.id,
            detector_type=detector.type,
            service_account_id=service_account_id,
            title=investigation.title,
            source=_investigation_source(detector, evaluation, investigation),
            occurrence_id=investigation.id,
        )


def _investigation_source(
    detector: Detector, evaluation: DetectorEvaluation, investigation: DetectorInvestigation
) -> dict[str, Any]:
    detected = f"Detected at {investigation.detection_time.isoformat()}"
    if investigation.environment:
        detected += f" in the {investigation.environment} environment"
    lines = [investigation.title, investigation.subtitle, f"{detected}."]
    lines.extend(f"{name}: {value}" for name, value in investigation.evidence_display)
    lines.append("Decide whether this needs action and, if it does, find the cause.")
    return {
        "type": NotebookSourceType.MANUAL,
        "prompt": "\n".join(line for line in lines if line),
        "seed": {
            "detectorId": detector.id,
            "detectorType": detector.type,
            "groupKey": evaluation.data["group_key"],
            "evidence": investigation.evidence_data,
        },
    }
