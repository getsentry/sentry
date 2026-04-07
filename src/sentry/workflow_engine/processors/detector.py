from __future__ import annotations

import logging
from dataclasses import dataclass

import sentry_sdk

from sentry import features, options
from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.services.eventstore.models import GroupEvent
from sentry.utils import metrics

# TODO - remove this import once getsentry can be updated
from sentry.workflow_engine.defaults.detectors import (
    ensure_default_detectors as ensure_default_detectors,
)
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.models.detector_group import DetectorGroup
from sentry.workflow_engine.types import (
    DetectorEvaluationResult,
    DetectorGroupKey,
    WorkflowEventData,
)
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType

logger = logging.getLogger(__name__)


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


# TODO - Delete this once the issue stream is fully rolled out.
def _is_issue_stream_detector_enabled(event_data: WorkflowEventData) -> bool:
    """
    Check if the issue stream detector should be enabled for this event's group type.

    Most group types enable the issue stream detector by default. MetricIssue is excluded
    unless the workflow-engine-metric-issue-ui feature flag is enabled for the organization,
    which allows incremental rollout of issue alerts for metric issues.
    """
    group_type_id = event_data.group.type
    disabled_type_ids = options.get("workflow_engine.group.type_id.disable_issue_stream_detector")
    if group_type_id not in disabled_type_ids:
        return True

    if group_type_id != MetricIssue.type_id:
        return False

    organization = event_data.event.project.organization

    has_metric_issue_ui = features.has(
        "organizations:workflow-engine-metric-issue-ui", organization
    )
    # For most users, the issue stream detector for metric issues will be rolled out along with the metric issue UI.
    # For users who find that behavior undesirable, this feature flag will disable it for them.
    disable_issue_stream_detector_for_metric_issues = features.has(
        "organizations:workflow-engine-metric-issue-disable-issue-detector-notifications",
        organization,
    )
    return has_metric_issue_ui and not disable_issue_stream_detector_for_metric_issues


def get_detectors_for_event_data(
    event_data: WorkflowEventData,
    detector: Detector | None = None,
) -> EventDetectors | None:
    """
    Returns a list of detectors for the event to process workflows for.

    We always return at least the issue stream detector, unless excluded via option or feature flag.
    If the event has an associated detector, we return it too.

    We expect a detector to be passed in for Activity updates.
    """
    issue_stream_detector: Detector | None = None

    try:
        if _is_issue_stream_detector_enabled(event_data):
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
        detector = _get_detector_for_event(event_data.event)
    try:
        return EventDetectors(issue_stream_detector=issue_stream_detector, event_detector=detector)
    except ValueError:
        return None


def _get_detector_for_event(event: GroupEvent) -> Detector | None:
    """
    Returns the detector from the GroupEvent in event_data, or None if no detector is found.
    """
    issue_occurrence = event.occurrence
    try:
        if issue_occurrence is not None:
            detector_id = issue_occurrence.evidence_data.get("detector_id")
            if detector_id is None:
                return None
            return Detector.objects.get(id=detector_id)
        else:
            return Detector.get_error_detector_for_project(event.group.project_id)
    except Detector.DoesNotExist:
        return None


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


# TODO - move to another file / location
def associate_new_group_with_detector(group: Group, detector_id: int | None = None) -> bool:
    """
    Associate a new Group with it's Detector in the database.
    If the Group is an error, it can be associated without a detector ID.

    Return whether the group was associated.
    """
    if detector_id is None:
        # For error Groups, we expect there to be a Detector that we can find by project.
        # The detector may be missing due to concurrent project deletion.
        if group.type == ErrorGroupType.type_id:
            if not options.get("workflow_engine.associate_error_detectors", False):
                return False
            try:
                detector_id = Detector.get_error_detector_for_project(group.project.id).id
            except Detector.DoesNotExist:
                # If the project is mid-deletion, the detector will be missing, so infrequently
                # hitting this case is fine, but we add a metric to make sure it stays infrequent.
                metrics.incr(
                    "workflow_engine.associate_new_group_with_detector",
                    tags={"group_type": group.type, "result": "error_detector_not_found"},
                )
                logger.info(
                    "associate_new_group_with_detector_error_detector_not_found",
                    extra={
                        "group_id": group.id,
                        "group_type": group.type,
                        "project_id": group.project.id,
                    },
                )
                return False
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


# TODO - move to another file / location
def ensure_association_with_detector(group: Group, detector_id: int | None = None) -> bool:
    """
    Ensure a Group has a DetectorGroup association, creating it if missing.
    Backdates date_added to group.first_seen for gradual backfill of existing groups.
    """
    if not options.get("workflow_engine.ensure_detector_association"):
        return False

    # Common case: it exists, we verify and move on.
    try:
        DetectorGroup.objects.get_from_cache(group=group)
        return True
    except DetectorGroup.DoesNotExist:
        pass

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
