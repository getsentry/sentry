from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Mapping

import sentry_sdk

from sentry.eventstore.models import GroupEvent
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

    if not isinstance(evt, GroupEvent):
        raise TypeError(
            "Can only use `get_detector_by_event` for a new event, Activity updates are not supported"
        )

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


def get_detectors_by_events_bulk(
    event_list: list[GroupEvent],
) -> Mapping[str, Detector]:
    if not event_list:
        return {}

    # Separate events by whether they have occurrences or not
    events_with_occurrences: list[tuple[GroupEvent, IssueOccurrence]] = []
    events_without_occurrences: list[GroupEvent] = []

    for event in event_list:
        issue_occurrence = event.occurrence

        if issue_occurrence is None:
            events_without_occurrences.append(event)
        else:
            events_with_occurrences.append((event, issue_occurrence))

    result: dict[str, Detector] = {}

    # Fetch detectors for events with occurrences (by detector_id)
    if events_with_occurrences:
        # detector_ids = set([issue_occurrence.evidence_data.get("detector_id", None) for ])
        detector_ids = []
        event_id_to_detector_id: dict[str, int] = {}

        for event, occurrence in events_with_occurrences:
            detector_id = occurrence.evidence_data.get("detector_id")
            if detector_id is not None:
                detector_ids.append(detector_id)
                event_id_to_detector_id[event.event_id] = detector_id

        if detector_ids:
            try:
                detectors_by_id = {
                    detector.id: detector
                    for detector in Detector.objects.filter(id__in=detector_ids)
                }

                for event_id, detector_id in event_id_to_detector_id.items():
                    detector = detectors_by_id.get(detector_id)
                    if detector:
                        result[event_id] = detector
                    else:
                        metrics.incr("workflow_engine.detectors.error")
                        logger.warning(
                            "Detector not found for event with occurrence",
                            extra={
                                "event_id": event_id,
                                "detector_id": detector_id,
                            },
                        )
            except Exception:
                logger.exception("Error fetching detectors by ID in bulk operation")
                metrics.incr("workflow_engine.detectors.bulk_error")

    # Fetch detectors for events without occurrences (by project_id and issue_type)
    if events_without_occurrences:
        # Group events by project_id to minimize queries
        project_events: dict[int, list[str]] = defaultdict(list)

        for event in events_without_occurrences:
            project_events[event.project_id].append(event.event_id)

        try:
            # Fetch all detectors for the projects in one query
            project_ids = list(project_events.keys())
            detectors_by_project = {
                detector.project_id: detector
                for detector in Detector.objects.filter(project_id__in=project_ids)
            }

            # Assign detectors to events
            for project_id, event_ids in project_events.items():
                detector = detectors_by_project.get(project_id)
                if detector:
                    for event_id in event_ids:
                        result[event_id] = detector
                else:
                    metrics.incr("workflow_engine.detectors.error")
                    logger.warning(
                        "Detector not found for project",
                        extra={
                            "project_id": project_id,
                            "event_count": len(event_ids),
                        },
                    )
        except Exception:
            logger.exception("Error fetching detectors by project in bulk operation")
            metrics.incr("workflow_engine.detectors.bulk_error")

    return result


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


@sentry_sdk.trace
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
