from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Callable, Mapping
from typing import NamedTuple

import sentry_sdk
from django.db import router, transaction
from rest_framework import status

from sentry import options
from sentry.api.exceptions import SentryAPIException
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.grouping.grouptype import ErrorGroupType
from sentry.issues import grouptype
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.locks import locks
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.services.eventstore.models import GroupEvent
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.models.detector_group import DetectorGroup
from sentry.workflow_engine.types import (
    ERROR_DETECTOR_NAME,
    ISSUE_STREAM_DETECTOR_NAME,
    DetectorEvaluationResult,
    DetectorGroupKey,
    WorkflowEventData,
)
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType

logger = logging.getLogger(__name__)

VALID_DEFAULT_DETECTOR_TYPES = [ErrorGroupType.slug, IssueStreamGroupType.slug]


class UnableToAcquireLockApiError(SentryAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "unable_to_acquire_lock"
    message = "Unable to acquire lock for issue alert migration."


def _ensure_detector(project: Project, type: str) -> Detector:
    """
    Ensure that a detector of a given type exists for a project.
    If the Detector doesn't already exist, we try to acquire a lock to avoid double-creating,
    and UnableToAcquireLockApiError if that fails.
    """
    group_type = grouptype.registry.get_by_slug(type)
    if not group_type:
        raise ValueError(f"Group type {type} not registered")
    slug = group_type.slug
    if slug not in VALID_DEFAULT_DETECTOR_TYPES:
        raise ValueError(f"Invalid default detector type: {slug}")

    # If it already exists, life is simple and we can return immediately.
    # If there happen to be duplicates, we prefer the oldest.
    existing = Detector.objects.filter(type=slug, project=project).order_by("id").first()
    if existing:
        return existing

    # If we may need to create it, we acquire a lock to avoid double-creating.
    # There isn't a unique constraint on the detector, so we can't rely on get_or_create
    # to avoid duplicates.
    # However, by only locking during the one-time creation, the window for a race condition is small.
    lock = locks.get(
        f"workflow-engine-project-{slug}-detector:{project.id}",
        duration=2,
        name=f"workflow_engine_default_{slug}_detector",
    )
    try:
        with (
            # Creation should be fast, so it's worth blocking a little rather
            # than failing a request.
            lock.blocking_acquire(initial_delay=0.1, timeout=3),
            transaction.atomic(router.db_for_write(Detector)),
        ):
            detector, _ = Detector.objects.get_or_create(
                type=slug,
                project=project,
                defaults={
                    "config": {},
                    "name": (
                        ERROR_DETECTOR_NAME
                        if slug == ErrorGroupType.slug
                        else ISSUE_STREAM_DETECTOR_NAME
                    ),
                },
            )
            return detector
    except UnableToAcquireLock:
        raise UnableToAcquireLockApiError


def ensure_default_detectors(project: Project) -> tuple[Detector, Detector]:
    return _ensure_detector(project, ErrorGroupType.slug), _ensure_detector(
        project, IssueStreamGroupType.slug
    )


def get_detector_by_event(event_data: WorkflowEventData) -> Detector:
    evt = event_data.event

    if not isinstance(evt, GroupEvent):
        raise TypeError(
            "Can only use `get_detector_by_event` for a new event, Activity updates are not supported"
        )

    issue_occurrence = evt.occurrence

    detector: Detector | None = None

    if issue_occurrence is None or evt.group.issue_type.detector_settings is None:
        # if there are no detector settings, default to the error detector
        detector = Detector.get_error_detector_for_project(evt.project_id)
    elif issue_occurrence and (detector_id := issue_occurrence.evidence_data.get("detector_id")):
        detector = Detector.objects.filter(id=detector_id).first()

    if detector is not None:
        return detector

    try:
        return Detector.objects.get(type=IssueStreamGroupType.slug, project_id=evt.project_id)
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


class _SplitEvents(NamedTuple):
    events_with_occurrences: list[tuple[GroupEvent, int]]
    error_events: list[GroupEvent]
    issue_stream_events: list[GroupEvent]


def _split_events_by_occurrence(
    event_list: list[GroupEvent],
) -> _SplitEvents:
    events_with_occurrences: list[tuple[GroupEvent, int]] = []
    error_events: list[GroupEvent] = []  # only error events don't have occurrences
    issue_stream_events: list[GroupEvent] = (
        []
    )  # all other events are picked up by the issue stream detector

    for event in event_list:
        issue_occurrence = event.occurrence
        if issue_occurrence is None:
            assert event.group.issue_type.slug == ErrorGroupType.slug
            error_events.append(event)
        elif detector_id := issue_occurrence.evidence_data.get("detector_id"):
            events_with_occurrences.append((event, detector_id))
        else:
            issue_stream_events.append(event)

    return _SplitEvents(
        events_with_occurrences,
        error_events,
        issue_stream_events,
    )


def _create_event_detector_map(
    detectors: BaseQuerySet[Detector],
    key_event_map: dict[int, list[GroupEvent]],
    detector_key_extractor: Callable[[Detector], int],
) -> tuple[dict[str, Detector], set[int]]:
    result: dict[str, Detector] = {}

    # used to track existing keys (detector_id or project_id) to log missing keys
    keys = set()

    for detector in detectors:
        key = detector_key_extractor(detector)
        keys.add(key)
        detector_events = key_event_map[key]
        result.update({event.event_id: detector for event in detector_events})

    return result, keys


def _create_default_event_detector_map(
    events: list[GroupEvent], type: str
) -> tuple[dict[str, Detector], set[int], dict[int, list[GroupEvent]]]:
    project_to_events: dict[int, list[GroupEvent]] = defaultdict(list)

    for event in events:
        project_to_events[event.project_id].append(event)

    def _extract_events_lookup_key(detector: Detector) -> int:
        return detector.project_id

    detectors = Detector.objects.filter(
        project_id__in=project_to_events.keys(),
        type=type,
    )
    mapping, projects_with_detectors = _create_event_detector_map(
        detectors,
        key_event_map=project_to_events,
        detector_key_extractor=_extract_events_lookup_key,
    )
    return mapping, projects_with_detectors, project_to_events


def get_detectors_by_groupevents_bulk(
    event_list: list[GroupEvent],
) -> Mapping[str, Detector]:
    """
    Given a list of GroupEvents, return a mapping of event_id to Detector.
    """
    if not event_list:
        return {}

    result: dict[str, Detector] = {}

    # Separate events by whether they have occurrences or not
    events_with_occurrences, error_events, issue_stream_events = _split_events_by_occurrence(
        event_list
    )

    # Fetch detectors for events with occurrences (by detector_id)
    missing_detector_ids: set[int] = set()
    if events_with_occurrences:
        detector_id_to_events: dict[int, list[GroupEvent]] = defaultdict(list)

        for event, detector_id in events_with_occurrences:
            detector_id_to_events[detector_id].append(event)

        def _extract_events_lookup_key(detector: Detector) -> int:
            return detector.id

        if detector_id_to_events:
            detectors = Detector.objects.filter(id__in=list(detector_id_to_events.keys()))
            mapping, found_detector_ids = _create_event_detector_map(
                detectors,
                key_event_map=detector_id_to_events,
                detector_key_extractor=_extract_events_lookup_key,
            )
            result.update(mapping)

            # events with missing detectors can be picked up by the issue stream detector
            for project_id, events in detector_id_to_events.items():
                if project_id not in found_detector_ids:
                    issue_stream_events.extend(events)

            missing_detector_ids.update(set(detector_id_to_events.keys()) - found_detector_ids)

    # Fetch detectors for events without occurrences (by project_id)
    projects_missing_detectors: set[int] = set()
    if error_events:
        mapping, projects_with_error_detectors, project_to_events = (
            _create_default_event_detector_map(error_events, ErrorGroupType.slug)
        )
        result.update(mapping)

        # events with missing detectors can be picked up by the issue stream detector
        for project_id, events in project_to_events.items():
            if project_id not in projects_with_error_detectors:
                issue_stream_events.extend(events)

    if issue_stream_events:
        mapping, projects_with_issue_stream_detectors, project_to_events = (
            _create_default_event_detector_map(issue_stream_events, IssueStreamGroupType.slug)
        )
        result.update(mapping)

        # if no detectors, then something is wrong
        projects_missing_detectors -= projects_with_issue_stream_detectors
        projects_missing_detectors.update(
            set(project_to_events.keys()) - projects_with_issue_stream_detectors
        )

    # Log all missing detectors
    if missing_detector_ids or projects_missing_detectors:
        metrics.incr(
            "workflow_engine.detectors.error",
            amount=len(projects_missing_detectors) + len(missing_detector_ids),
        )
        logger.error(
            "Detectors not found for events",
            extra={
                "projects_missing_error_detectors": projects_missing_detectors,
                "missing_detectors": missing_detector_ids,
            },
        )

    return result


def create_issue_platform_payload(result: DetectorEvaluationResult, detector_type: str) -> None:
    occurrence, status_change = None, None

    if isinstance(result.result, IssueOccurrence):
        occurrence = result.result
        payload_type = PayloadType.OCCURRENCE

        metrics.incr(
            "workflow_engine.issue_platform.payload.sent.occurrence",
            tags={"detector_type": detector_type},
            sample_rate=1,
        )
    else:
        status_change = result.result
        payload_type = PayloadType.STATUS_CHANGE
        metrics.incr(
            "workflow_engine.issue_platform.payload.sent.status_change",
            tags={"detector_type": detector_type},
            sample_rate=1,
        )

    produce_occurrence_to_kafka(
        payload_type=payload_type,
        occurrence=occurrence,
        status_change=status_change,
        event_data=result.event_data,
    )


@sentry_sdk.trace
def process_detectors[T](
    data_packet: DataPacket[T], detectors: list[Detector]
) -> list[tuple[Detector, dict[DetectorGroupKey, DetectorEvaluationResult]]]:
    results: list[tuple[Detector, dict[DetectorGroupKey, DetectorEvaluationResult]]] = []

    for detector in detectors:
        handler = detector.detector_handler

        if not handler:
            continue

        metrics.incr(
            "workflow_engine.process_detector",
            tags={"detector_type": detector.type},
        )

        with metrics.timer(
            "workflow_engine.process_detectors.evaluate", tags={"detector_type": detector.type}
        ):
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
                create_issue_platform_payload(result, detector.type)

        if detector_results:
            results.append((detector, detector_results))

    return results


def associate_new_group_with_detector(group: Group, detector_id: int | None = None) -> bool:
    """
    Associate a new Group with it's Detector in the database.
    If the Group is an error, it can be associated without a detector ID.

    Return whether the group was associated.
    """
    if detector_id is None:
        # For error Groups, we know there is a Detector and we can find it by project.
        if group.type == ErrorGroupType.type_id:
            if not options.get("workflow_engine.associate_error_detectors", False):
                return False
            detector_id = Detector.get_error_detector_for_project(group.project.id).id
        else:
            return False
    DetectorGroup.objects.get_or_create(
        detector_id=detector_id,
        group_id=group.id,
    )
    return True
