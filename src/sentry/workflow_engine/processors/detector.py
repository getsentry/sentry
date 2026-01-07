from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import timedelta
from typing import NamedTuple

import sentry_sdk
from django.db import router, transaction
from rest_framework import status

from sentry import options
from sentry.api.exceptions import SentryAPIException
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.issues import grouptype
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.locks import locks
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.seer.anomaly_detection.store_data_workflow_engine import send_new_detector_data
from sentry.seer.anomaly_detection.types import (
    AnomalyDetectionSeasonality,
    AnomalyDetectionSensitivity,
    AnomalyDetectionThresholdType,
)
from sentry.services.eventstore.models import GroupEvent
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock
from sentry.workflow_engine.models import DataPacket, DataSource, Detector
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.models.data_condition_group import DataConditionGroup
from sentry.workflow_engine.models.data_source_detector import DataSourceDetector
from sentry.workflow_engine.models.detector_group import DetectorGroup
from sentry.workflow_engine.types import (
    ERROR_DETECTOR_NAME,
    ISSUE_STREAM_DETECTOR_NAME,
    DetectorEvaluationResult,
    DetectorGroupKey,
    DetectorPriorityLevel,
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


def _ensure_metric_detector(
    project: Project, owner_team_id: int | None = None, enabled: bool = True
) -> Detector | None:
    """
    Ensure that a default anomaly detection metric monitor exists for a project.
    If the Detector doesn't already exist, we try to acquire a lock to avoid double-creating.
    """
    # If it already exists, return immediately. Prefer the oldest if duplicates exist.
    existing = (
        Detector.objects.filter(type=MetricIssue.slug, project=project).order_by("id").first()
    )
    if existing:
        return existing

    lock = locks.get(
        f"workflow-engine-project-{MetricIssue.slug}-detector:{project.id}",
        duration=2,
        name=f"workflow_engine_default_{MetricIssue.slug}_detector",
    )
    try:
        with (
            lock.blocking_acquire(initial_delay=0.1, timeout=3),
            transaction.atomic(router.db_for_write(Detector)),
        ):
            # Double-check after acquiring lock in case another process created it
            existing = (
                Detector.objects.filter(type=MetricIssue.slug, project=project)
                .order_by("id")
                .first()
            )
            if existing:
                return existing

            condition_group = DataConditionGroup.objects.create(
                logic_type=DataConditionGroup.Type.ANY,
                organization_id=project.organization_id,
            )

            DataCondition.objects.create(
                comparison={
                    "sensitivity": AnomalyDetectionSensitivity.LOW,
                    "seasonality": AnomalyDetectionSeasonality.AUTO,
                    "threshold_type": AnomalyDetectionThresholdType.ABOVE,
                },
                condition_result=DetectorPriorityLevel.HIGH,
                type=Condition.ANOMALY_DETECTION,
                condition_group=condition_group,
            )

            detector = Detector.objects.create(
                project=project,
                name="High Error Count (Default)",
                description="Automatically monitors for anomalous spikes in error count",
                workflow_condition_group=condition_group,
                type=MetricIssue.slug,
                config={
                    "detection_type": AlertRuleDetectionType.DYNAMIC.value,
                    "comparison_delta": None,
                },
                owner_team_id=owner_team_id,
                enabled=enabled,
            )

            snuba_query = create_snuba_query(
                query_type=SnubaQuery.Type.ERROR,
                dataset=Dataset.Events,
                query="",
                aggregate="count()",
                time_window=timedelta(minutes=15),
                resolution=timedelta(minutes=15),
                environment=None,
                event_types=[SnubaQueryEventType.EventType.ERROR],
            )

            query_subscription = create_snuba_subscription(
                project=project,
                subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=snuba_query,
            )

            data_source = DataSource.objects.create(
                organization_id=project.organization_id,
                source_id=str(query_subscription.id),
                type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
            )

            DataSourceDetector.objects.create(
                data_source=data_source,
                detector=detector,
            )

            try:
                send_new_detector_data(detector)
            except Exception:
                logger.exception(
                    "Failed to send new detector data to Seer, detector not created",
                    extra={"project_id": project.id, "organization_id": project.organization_id},
                )
                raise

            return detector
    except UnableToAcquireLock:
        raise UnableToAcquireLockApiError


def ensure_default_detectors(project: Project) -> tuple[Detector, Detector]:
    return _ensure_detector(project, ErrorGroupType.slug), _ensure_detector(
        project, IssueStreamGroupType.slug
    )


@dataclass(frozen=True)
class EventDetectors:
    issue_stream_detector: Detector | None = None
    event_detector: Detector | None = None

    def __post_init__(self) -> None:
        if not self.has_detectors:
            raise ValueError("At least one detector must be provided")

    @property
    def has_detectors(self) -> bool:
        """
        Returns True if at least one detector exists.
        """
        return self.issue_stream_detector is not None or self.event_detector is not None

    @property
    def preferred_detector(self) -> Detector:
        """
        The preferred detector is the one that should be used for the event,
        if we need to use a singular detector (for example, in logging).
        The class will not initialize if no detectors are found.
        """
        detector = self.event_detector or self.issue_stream_detector
        assert detector is not None, "At least one detector must exist"
        return detector

    @property
    def detectors(self) -> set[Detector]:
        return {d for d in [self.issue_stream_detector, self.event_detector] if d is not None}


def get_detectors_for_event_data(
    event_data: WorkflowEventData,
    detector: Detector | None = None,
) -> EventDetectors | None:
    """
    Returns a list of detectors for the event to process workflows for.

    We always return at least the issue stream detector, unless excluded via option.
    If the event has an associated detector, we return it too.

    We expect a detector to be passed in for Activity updates.
    """
    issue_stream_detector: Detector | None = None
    exclude_issue_stream = options.get("workflow_engine.exclude_issue_stream_detector")

    if not exclude_issue_stream:
        try:
            issue_stream_detector = Detector.get_issue_stream_detector_for_project(
                event_data.group.project_id
            )
        except Detector.DoesNotExist:
            metrics.incr("workflow_engine.detectors.error")
            logger.exception(
                "Issue stream detector not found for event",
                extra={
                    "project_id": event_data.group.project_id,
                    "group_id": event_data.group.id,
                },
            )

    if detector is None and isinstance(event_data.event, GroupEvent):
        try:
            detector = _get_detector_for_event(event_data.event)
        except Detector.DoesNotExist:
            pass

    try:
        return EventDetectors(issue_stream_detector=issue_stream_detector, event_detector=detector)
    except ValueError:
        return None


def _get_detector_for_event(event: GroupEvent) -> Detector:
    """
    Returns the detector from the GroupEvent in event_data.
    """

    issue_occurrence = event.occurrence

    try:
        if issue_occurrence is not None:
            detector = Detector.objects.get(
                id=issue_occurrence.evidence_data.get("detector_id", None)
            )
        else:
            detector = Detector.get_error_detector_for_project(event.group.project_id)
    except Detector.DoesNotExist:
        metrics.incr("workflow_engine.detectors.error")
        detector_id = (
            issue_occurrence.evidence_data.get("detector_id") if issue_occurrence else None
        )

        logger.exception(
            "Detector not found for event",
            extra={
                "event_id": event.event_id,
                "group_id": event.group_id,
                "detector_id": detector_id,
            },
        )
        raise Detector.DoesNotExist("Detector not found for event")

    return detector


def _get_detector_for_group(group: Group) -> Detector:
    """
    Returns Detector associated with this group, either based on DetectorGroup,
    (project, type), or if those fail, returns the Issue Stream detector.
    """
    try:
        detector = DetectorGroup.objects.get(group=group).detector
        if detector is not None:
            return detector
    except DetectorGroup.DoesNotExist:
        logger.exception(
            "DetectorGroup not found for group",
            extra={"group_id": group.id},
        )
        pass

    try:
        return Detector.objects.get(project_id=group.project_id, type=group.issue_type.slug)
    except (Detector.DoesNotExist, Detector.MultipleObjectsReturned):
        # return issue stream detector
        return Detector.objects.get(project_id=group.project_id, type=IssueStreamGroupType.slug)


def get_preferred_detector(event_data: WorkflowEventData) -> Detector:
    """
    Attempts to fetch the specific detector based on the GroupEvent or Activity in event_data
    """
    try:
        if isinstance(event_data.event, GroupEvent):
            event_detectors = get_detectors_for_event_data(event_data)
            if event_detectors is None:
                raise Detector.DoesNotExist("No detectors found for event")
            return event_detectors.preferred_detector
        elif isinstance(event_data.event, Activity):
            return _get_detector_for_group(event_data.group)
        else:
            raise TypeError(f"Cannot determine the detector from {type(event_data.event)}.")
    except Detector.DoesNotExist:
        logger.exception(
            "Detector not found for event data",
            extra={
                "type": type(event_data.event),
                "id": (
                    event_data.event.event_id
                    if isinstance(event_data.event, GroupEvent)
                    else event_data.event.id
                ),
                "group_id": event_data.group.id,
            },
        )
        raise


class _SplitEvents(NamedTuple):
    events_with_occurrences: list[tuple[GroupEvent, int]]
    error_events: list[GroupEvent]
    events_missing_detectors: list[GroupEvent]


def _split_events_by_occurrence(
    event_list: list[GroupEvent],
) -> _SplitEvents:
    events_with_occurrences: list[tuple[GroupEvent, int]] = []
    error_events: list[GroupEvent] = []  # only error events don't have occurrences
    events_missing_detectors: list[GroupEvent] = []

    for event in event_list:
        issue_occurrence = event.occurrence
        if issue_occurrence is None:
            assert event.group.issue_type.slug == ErrorGroupType.slug
            error_events.append(event)
        elif detector_id := issue_occurrence.evidence_data.get("detector_id"):
            events_with_occurrences.append((event, detector_id))
        else:
            events_missing_detectors.append(event)

    return _SplitEvents(
        events_with_occurrences,
        error_events,
        events_missing_detectors,
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
            metrics.incr(
                "workflow_engine.associate_new_group_with_detector",
                tags={"group_type": group.type, "result": "failure"},
            )
            logger.warning(
                "associate_new_group_with_detector_failed",
                extra={
                    "group_id": group.id,
                    "group_type": group.type,
                },
            )
            return False

    # Check if the detector exists. If not, create DetectorGroup with null detector_id
    # to make it clear that we were associated with a detector that no longer exists.
    if not Detector.objects.filter(id=detector_id).exists():
        metrics.incr(
            "workflow_engine.associate_new_group_with_detector",
            tags={"group_type": group.type, "result": "detector_missing"},
        )
        logger.warning(
            "associate_new_group_with_detector_detector_missing",
            extra={
                "group_id": group.id,
                "group_type": group.type,
                "detector_id": detector_id,
            },
        )
        DetectorGroup.objects.get_or_create(
            detector_id=None,
            group_id=group.id,
        )
        return True

    DetectorGroup.objects.get_or_create(
        detector_id=detector_id,
        group_id=group.id,
    )
    metrics.incr(
        "workflow_engine.associate_new_group_with_detector",
        tags={"group_type": group.type, "result": "success"},
    )
    return True


def ensure_association_with_detector(group: Group, detector_id: int | None = None) -> bool:
    """
    Ensure a Group has a DetectorGroup association, creating it if missing.
    Backdates date_added to group.first_seen for gradual backfill of existing groups.
    """
    if not options.get("workflow_engine.ensure_detector_association"):
        return False

    # Common case: it exists, we verify and move on.
    if DetectorGroup.objects.filter(group_id=group.id).exists():
        return True

    # Association is missing, determine the detector_id if not provided
    if detector_id is None:
        # For error Groups, we know there is a Detector and we can find it by project.
        if group.type == ErrorGroupType.type_id:
            try:
                detector_id = Detector.get_error_detector_for_project(group.project.id).id
            except Detector.DoesNotExist:
                logger.warning(
                    "ensure_association_with_detector_detector_not_found",
                    extra={
                        "group_id": group.id,
                        "group_type": group.type,
                        "project_id": group.project.id,
                    },
                )
                return False
        else:
            return False
    else:
        # Check if the explicitly provided detector exists. If not, create DetectorGroup
        # with null detector_id to make it clear that we were associated with a detector
        # that no longer exists.
        if not Detector.objects.filter(id=detector_id).exists():
            detector_group, created = DetectorGroup.objects.get_or_create(
                group_id=group.id,
                defaults={"detector_id": None},
            )
            if created:
                # Backdate the date_added to match the group's first_seen
                DetectorGroup.objects.filter(id=detector_group.id).update(
                    date_added=group.first_seen
                )
                metrics.incr(
                    "workflow_engine.ensure_association_with_detector.created",
                    tags={"group_type": group.type},
                )
            return True

    detector_group, created = DetectorGroup.objects.get_or_create(
        group_id=group.id,
        defaults={"detector_id": detector_id},
    )

    if created:
        # Backdate the date_added to match the group's first_seen
        DetectorGroup.objects.filter(id=detector_group.id).update(date_added=group.first_seen)
        metrics.incr(
            "workflow_engine.ensure_association_with_detector.created",
            tags={"group_type": group.type},
        )

    return True
