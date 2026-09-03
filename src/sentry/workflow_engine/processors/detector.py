from __future__ import annotations

import logging
from dataclasses import dataclass, field

from sentry import features, options
from sentry.db.models.utils import is_model_attr_cached
from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.options.rollout import in_rollout_group
from sentry.services.eventstore.models import GroupEvent
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.tracing import trace

# TODO - remove this import once getsentry can be updated
from sentry.workflow_engine.defaults.detectors import (
    ensure_default_detectors as ensure_default_detectors,
)
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.models.detector_group import DetectorGroup
from sentry.workflow_engine.processors import DetectorEvaluation, ProcessDetectorsResult
from sentry.workflow_engine.processors.evaluation_logging import emit_detector_evaluation_logs
from sentry.workflow_engine.types import (
    DetectorGroupKey,
    DetectorId,
    WorkflowEventData,
)
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType

logger = logging.getLogger(__name__)


_DETECTOR_SENTINEL = object()


def _get_all_projects_detector_cache_key(organization_id: int) -> str:
    return f"detector:all_projects:{organization_id}"


def get_all_projects_detector(organization_id: int) -> Detector | None:
    with metrics.timer("workflow_engine.cache.all_projects_detector") as metrics_tags:
        cache_key = _get_all_projects_detector_cache_key(organization_id)
        cached = cache.get(cache_key, default=_DETECTOR_SENTINEL)
        if cached is not _DETECTOR_SENTINEL:
            metrics_tags["cache_hit"] = "true"
            metrics_tags["detector_found"] = "true" if cached is not None else "false"
            return cached
        try:
            result = Detector.objects.get_or_none(
                project__isnull=True,
                type=IssueStreamGroupType.slug,
                config__organization_id=organization_id,
            )
        except Detector.MultipleObjectsReturned:
            logger.exception(
                "get_all_projects_detector.many_exist", extra={"organization_id": organization_id}
            )
            result = None
        metrics_tags["cache_hit"] = "false"
        metrics_tags["detector_found"] = "true" if result is not None else "false"
        cache.set(cache_key, result, Detector.CACHE_TTL)

    return result


def invalidate_all_projects_detector_cache(instance: Detector) -> None:
    if instance.project_id is None:
        organization_id = instance.config.get("organization_id")
        if organization_id is not None:
            cache_key = _get_all_projects_detector_cache_key(organization_id)
            cache.delete(cache_key)


@dataclass(frozen=True)
class EventDetectors:
    issue_stream_detectors: list[Detector] = field(default_factory=list)
    """
    Assumed to be in priority order, since this is leveraged by preferred_detector.
    """
    event_detector: Detector | None = None

    def __post_init__(self) -> None:
        if not self.has_detectors:
            raise ValueError("At least one detector must be provided")

    @property
    def has_detectors(self) -> bool:
        """
        Returns True if at least one detector exists.
        """
        return bool(self.issue_stream_detectors) or self.event_detector is not None

    @property
    def preferred_detector(self) -> Detector:
        """
        The preferred detector is the one that should be used for the event,
        if we need to use a singular detector (for example, in logging).
        The class will not initialize if no detectors are found.
        """
        detector = self.event_detector or next(iter(self.issue_stream_detectors), None)
        assert detector is not None, "At least one detector must exist"
        return detector

    @property
    def detectors(self) -> set[Detector]:
        result = set(self.issue_stream_detectors)
        if self.event_detector is not None:
            result.add(self.event_detector)
        return result


# TODO - Delete this once the issue stream is fully rolled out.
def _is_issue_stream_detector_enabled(event_data: WorkflowEventData) -> bool:
    """
    Check if the issue stream detector should be enabled for this event's group type.
    """
    group_type_id = event_data.group.type
    disabled_type_ids = options.get("workflow_engine.group.type_id.disable_issue_stream_detector")
    if group_type_id not in disabled_type_ids:
        return True

    # Metric isssues are a special case currently.
    # In order to give users time to adjust to the new behavior, we allow them to disable the
    # issue stream detector for metric issues via a feature flag.
    if group_type_id != MetricIssue.type_id:
        return False

    organization = event_data.event.project.organization

    disable_issue_stream_detector_for_metric_issues = features.has(
        "organizations:workflow-engine-metric-issue-disable-issue-detector-notifications",
        organization,
    )
    return not disable_issue_stream_detector_for_metric_issues


def get_detectors_for_event_data(
    event_data: WorkflowEventData,
    detector: Detector | None = None,
) -> EventDetectors | None:
    """
    Returns a list of detectors for the event to process workflows for.

    We always return at least the issue stream detector, unless excluded via option or feature flag.
    If the event has an associated detector, we return it too.
    If an org-scoped all-project detector exists, we include it for workflow lookup.

    We expect a detector to be passed in for Activity updates.
    """
    # NOTE: Order determines priority: project-scoped first, then fall back to all-projects
    issue_stream_detectors: list[Detector] = []

    try:
        if _is_issue_stream_detector_enabled(event_data):
            issue_stream_detectors.append(
                Detector.get_issue_stream_detector_for_project(event_data.group.project_id)
            )
    except Detector.DoesNotExist:
        metrics.incr("workflow_engine.detectors.error", tags={"detector_type": "issue_stream"})
        logger.exception(
            "Issue stream detector not found for event",
            extra={"project_id": event_data.group.project_id, "group_id": event_data.group.id},
        )

    organization_id = event_data.event.project.organization_id
    if in_rollout_group("workflow_engine.all_projects_detectors.rollout-rate", organization_id):
        all_projects_detector = get_all_projects_detector(organization_id)
        if all_projects_detector:
            issue_stream_detectors.append(all_projects_detector)

    if detector is None and isinstance(event_data.event, GroupEvent):
        detector = _get_detector_for_event(event_data.event)
    try:
        return EventDetectors(
            issue_stream_detectors=issue_stream_detectors,
            event_detector=detector,
        )
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


def create_issue_platform_payload(result: DetectorEvaluation, detector_type: str) -> None:
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
        event_data=result.data["event_data"],
    )


def _get_detector_organization_id(detector: Detector) -> int | None:
    if detector.project_id is not None:
        if is_model_attr_cached(detector, "project"):
            project = detector.project
            return project.organization_id if project is not None else None
        return None

    return detector.config.get("organization_id", None)


@trace
def process_detectors[T](
    data_packet: DataPacket[T], detectors: list[Detector]
) -> list[tuple[Detector, dict[DetectorGroupKey, DetectorEvaluation]]]:
    results: list[tuple[Detector, dict[DetectorGroupKey, DetectorEvaluation]]] = []

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

        emit_detector_evaluation_logs(
            logger,
            organization_id=_get_detector_organization_id(detector),
            result=ProcessDetectorsResult(
                detector_id=detector.id,
                detector_type=detector.type,
                project_id=detector.project_id,
                evaluations=detector_results,
            ),
        )

        for result in detector_results.values():
            if result.result is not None:
                metric_label = (
                    "triggered" if isinstance(result.result, IssueOccurrence) else "resolved"
                )
                metrics.incr(
                    f"workflow_engine.process_detector.{metric_label}",
                    tags={"detector_type": detector.type},
                )

                create_issue_platform_payload(result, detector.type)

        if detector_results:
            results.append((detector, detector_results))

    return results


# TODO - move to another file / location
def associate_new_group_with_detector(group: Group, detector_id: DetectorId | None = None) -> bool:
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
def ensure_association_with_detector(group: Group, detector_id: DetectorId | None = None) -> bool:
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
