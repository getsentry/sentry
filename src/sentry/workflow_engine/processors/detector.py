from __future__ import annotations

import logging

from sentry.grouping.grouptype import ErrorGroupType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.utils import metrics
from sentry.workflow_engine.handlers.detector import DetectorEvaluationResult
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.types import DetectorGroupKey, WorkflowJob

logger = logging.getLogger(__name__)


def get_detector_by_event(job: WorkflowJob) -> Detector:
    evt = job["event"]
    issue_occurrence = evt.occurrence

    if issue_occurrence is None:
        # TODO - @saponifi3d - check to see if there's a way to confirm these are for the error detector
        detector = Detector.objects.get(project_id=evt.project_id, type=ErrorGroupType.slug)
    else:
        detector = Detector.objects.get(id=issue_occurrence.evidence_data.get("detector_id", None))

    return detector


def create_issue_occurrence_from_result(result: DetectorEvaluationResult):
    occurrence, status_change = None, None

    if isinstance(result.result, IssueOccurrence):
        occurrence = result.result
        payload_type = PayloadType.OCCURRENCE
    else:
        status_change = result.result
        payload_type = PayloadType.STATUS_CHANGE

    produce_occurrence_to_kafka(
        payload_type=payload_type,
        occurrence=occurrence,
        status_change=status_change,
        event_data=result.event_data,
    )


def process_detectors(
    data_packet: DataPacket, detectors: list[Detector]
) -> list[tuple[Detector, dict[DetectorGroupKey, DetectorEvaluationResult]]]:
    results = []

    for detector in detectors:
        handler = detector.detector_handler

        if not handler:
            continue

        metrics.incr(
            "workflow_engine.process_detector",
            tags={"detector_type": detector.type},
        )

        detector_results = handler.evaluate(data_packet)

        for result in detector_results.values():
            if result.result is not None:
                metrics.incr(
                    "workflow_engine.process_detector.triggered",
                    tags={"detector_type": detector.type},
                )
                create_issue_occurrence_from_result(result)

        if detector_results:
            results.append((detector, detector_results))

        # Now that we've processed all results for this detector, commit any state changes
        handler.commit_state_updates()

    return results
