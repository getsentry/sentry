from __future__ import annotations

import logging

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.utils import metrics
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.types import (
    DetectorEvaluationResult,
    DetectorGroupKey,
    WorkflowEventData,
)

logger = logging.getLogger(__name__)


def get_detector_by_event(event_data: WorkflowEventData) -> Detector:
    evt = event_data.event
    issue_occurrence = evt.occurrence

    try:
        if issue_occurrence is None:
            # TODO - @saponifi3d - check to see if there's a way to confirm these are for the error detector
            detector = Detector.objects.get(
                project_id=evt.project_id, type=evt.group.issue_type.slug
            )
        else:
            detector = Detector.objects.get(
                id=issue_occurrence.evidence_data.get("detector_id", None)
            )
    except Detector.DoesNotExist:
        metrics.incr("workflow_engine.detectors.error")
        detector_id = (
            issue_occurrence.evidence_data.get("detector_id") if issue_occurrence else None
        )

        logger.exception(
            "Detector not found for event",
            extra={
                "event_id": evt.event_id,
                "group_id": evt.group_id,
                "detector_id": detector_id,
            },
        )
        raise Detector.DoesNotExist("Detector not found for event")

    return detector


def create_issue_platform_payload(result: DetectorEvaluationResult) -> None:
    occurrence, status_change = None, None

    if isinstance(result.result, IssueOccurrence):
        occurrence = result.result
        payload_type = PayloadType.OCCURRENCE

        metrics.incr("workflow_engine.issue_platform.payload.sent.occurrence")
    else:
        status_change = result.result
        payload_type = PayloadType.STATUS_CHANGE
        metrics.incr("workflow_engine.issue_platform.payload.sent.status_change")

    produce_occurrence_to_kafka(
        payload_type=payload_type,
        occurrence=occurrence,
        status_change=status_change,
        event_data=result.event_data,
    )


def process_detectors[
    T
](data_packet: DataPacket[T], detectors: list[Detector]) -> list[
    tuple[Detector, dict[DetectorGroupKey, DetectorEvaluationResult]]
]:
    results: list[tuple[Detector, dict[DetectorGroupKey, DetectorEvaluationResult]]] = []

    for detector in detectors:
        handler = detector.detector_handler

        if not handler:
            continue

        metrics.incr(
            "workflow_engine.process_detector",
            tags={"detector_type": detector.type},
        )

        detector_results = handler.evaluate(data_packet)

        if detector_results is None:
            return results

        for result in detector_results.values():
            logger_extra = {
                "detector": detector.id,
                "detector_type": detector.type,
                "evaluation_data": data_packet.packet,
                "result": result,
            }
            if result.result is not None:
                if isinstance(result.result, IssueOccurrence):
                    metrics.incr(
                        "workflow_engine.process_detector.triggered",
                        tags={"detector_type": detector.type},
                    )
                    logger.info(
                        "detector_triggered",
                        extra=logger_extra,
                    )
                else:
                    metrics.incr(
                        "workflow_engine.process_detector.resolved",
                        tags={"detector_type": detector.type},
                    )
                    logger.info(
                        "detector_resolved",
                        extra=logger_extra,
                    )
                create_issue_platform_payload(result)

        if detector_results:
            results.append((detector, detector_results))

    return results
