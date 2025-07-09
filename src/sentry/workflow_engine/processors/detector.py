from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Callable, Mapping

import sentry_sdk

from sentry.db.models.manager.base_query_set import BaseQuerySet
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


def _split_events_by_occurrence(
    event_list: list[GroupEvent],
) -> tuple[list[tuple[GroupEvent, int]], list[GroupEvent], list[GroupEvent]]:
    events_with_occurrences: list[tuple[GroupEvent, int]] = []
    events_without_occurrences: list[GroupEvent] = []  # only error events don't have occurrences
    events_missing_detectors: list[GroupEvent] = []

    for event in event_list:
        issue_occurrence = event.occurrence

        if issue_occurrence is None:
            events_without_occurrences.append(event)
        elif detector_id := issue_occurrence.evidence_data.get("detector_id"):
            events_with_occurrences.append((event, detector_id))
        else:
            events_missing_detectors.append(event)

    return events_with_occurrences, events_without_occurrences, events_missing_detectors


def _update_event_detector_map(
    map: dict[str, Detector],
    detectors: BaseQuerySet[Detector],
    key_event_map: dict[int, list[GroupEvent]],
    detector_key_extractor: Callable[[Detector], int],
) -> tuple[dict[str, Detector], set[int]]:
    # used to track existing keys (detector_id or project_id) to log missing keys
    keys = set()

    for detector in detectors:
        key = detector_key_extractor(detector)
        keys.add(key)
        detector_events = key_event_map[key]
        map.update({event.event_id: detector for event in detector_events})

    return map, keys


def get_detectors_by_groupevents_bulk(
    event_list: list[GroupEvent],
) -> Mapping[str, Detector]:
    if not event_list:
        return {}

    result: dict[str, Detector] = {}

    # Separate events by whether they have occurrences or not
    events_with_occurrences, events_without_occurrences, events_missing_detectors = (
        _split_events_by_occurrence(event_list)
    )

    # Fetch detectors for events with occurrences (by detector_id)
    missing_detector_ids = set()
    if events_with_occurrences:
        detector_id_to_events: dict[int, list[GroupEvent]] = defaultdict(list)

        for event, detector_id in events_with_occurrences:
            detector_id_to_events[detector_id].append(event)

        def _extract_events_lookup_key(detector: Detector) -> int:
            return detector.id

        if detector_id_to_events:
            detectors = Detector.objects.filter(id__in=list(detector_id_to_events.keys()))
            result, found_detector_ids = _update_event_detector_map(
                result,
                detectors,
                key_event_map=detector_id_to_events,
                detector_key_extractor=_extract_events_lookup_key,
            )

            missing_detector_ids = set(detector_id_to_events.keys()) - found_detector_ids

    # Fetch detectors for events without occurrences (by project_id)
    projects_missing_detectors = set()
    if events_without_occurrences:
        # Group events by project_id
        project_to_events: dict[int, list[GroupEvent]] = defaultdict(list)

        for event in events_without_occurrences:
            project_to_events[event.project_id].append(event)

        def _extract_events_lookup_key(detector: Detector) -> int:
            return detector.project_id

        if project_to_events:
            detectors = Detector.objects.filter(
                project_id__in=project_to_events.keys(),
                type=events_without_occurrences[0].group.issue_type.slug,  # error type
            )
            result, projects_with_error_detectors = _update_event_detector_map(
                result,
                detectors,
                key_event_map=project_to_events,
                detector_key_extractor=_extract_events_lookup_key,
            )

            projects_missing_detectors = (
                set(project_to_events.keys()) - projects_with_error_detectors
            )

    # Log all missing detectors
    if missing_detector_ids or projects_missing_detectors or events_missing_detectors:
        metrics.incr(
            "workflow_engine.detectors.error",
            amount=len(projects_missing_detectors) + len(missing_detector_ids),
        )
        logger.error(
            "Detectors not found for events",
            extra={
                "projects_missing_error_detectors": projects_missing_detectors,
                "missing_detectors": missing_detector_ids,
                "events_missing_detectors": [
                    (event.event_id, event.group_id) for event in events_missing_detectors
                ],
            },
        )

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
