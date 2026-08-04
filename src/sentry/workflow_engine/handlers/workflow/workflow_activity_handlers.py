import logging

from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.seer.smart_assignment.models import RESOLUTION_ACTIVITIES
from sentry.types.activity import ActivityType
from sentry.utils import metrics
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.processors.detector import get_preferred_detector
from sentry.workflow_engine.registry import workflow_activity_registry
from sentry.workflow_engine.tasks.workflows import process_workflow_activity
from sentry.workflow_engine.types import DetectorId, WorkflowEventData

logger = logging.getLogger(__name__)

# Seer runs on an issue and reaches the stage...
SEER_WORKFLOW_ACTIVITIES = [
    ActivityType.SEER_RCA_COMPLETED,
    ActivityType.SEER_SOLUTION_COMPLETED,
    ActivityType.SEER_CODING_COMPLETED,
    ActivityType.SEER_PR_CREATED,
]

# Activity types handled by the generic activity_handler.
SUPPORTED_ACTIVITIES = [
    ActivityType.SET_RESOLVED,
    ActivityType.SET_RESOLVED_IN_RELEASE,
    ActivityType.SET_RESOLVED_BY_AGE,
    ActivityType.SET_RESOLVED_IN_COMMIT,
    # We omit SET_RESOLVED_IN_PULL_REQUEST because it's a misnomer.
    # When it fires, it means the issue was referenced in a pull request, not resolved.
]

# Activities the smart assignment feature reacts to: a Seer AI step starting, an
# assignment, or a resolution. Each triggers a prediction (deduped to one per group)
# and records ground truth; gating lives in trigger_smart_assignment. The exact
# ActivityType is forwarded through as the trigger (see smart_assignment.models).
_SMART_ASSIGNMENT_ACTIVITIES = RESOLUTION_ACTIVITIES | frozenset(
    {
        ActivityType.SEER_RCA_STARTED,
        ActivityType.SEER_SOLUTION_STARTED,
        ActivityType.SEER_CODING_STARTED,
        ActivityType.ASSIGNED,
    }
)


@workflow_activity_registry.register("seer_activity")
def seer_activity_handler(
    group: Group,
    activity: Activity,
    detector_id: DetectorId | None = None,
) -> None:
    logging_ctx = {
        "activity_type": activity.type,
        "group_id": group.id,
        "project_id": group.project_id,
    }

    try:
        activity_type = ActivityType(activity.type)
    except ValueError:
        logger.exception(
            "workflow_engine.seer_activity_handler.invalid_activity_type", extra=logging_ctx
        )
        return
    logging_ctx["activity_name"] = activity_type.name

    if activity_type not in SEER_WORKFLOW_ACTIVITIES:
        return

    event_data = WorkflowEventData(event=activity, group=group)

    try:
        if detector_id is not None:
            detector = Detector.objects.get(pk=detector_id)
        else:
            detector = get_preferred_detector(event_data=event_data)
    except Detector.DoesNotExist:
        logger.exception(
            "workflow_engine.seer_activity_handler.missing_detector", extra=logging_ctx
        )
        return

    logging_ctx["detector_id"] = detector.id
    logging_ctx["detector_type"] = detector.type

    process_workflow_activity.delay(
        activity_id=activity.id,
        group_id=group.id,
        detector_id=detector.id,
    )
    metrics.incr(
        "workflow_engine.seer_activity_handler.complete",
        tags={"activity_name": activity_type.name},
    )
    logger.info("workflow_engine.seer_activity_handler.complete", extra=logging_ctx)


@workflow_activity_registry.register("smart_assignment_trigger")
def smart_assignment_trigger_handler(
    group: Group,
    activity: Activity,
    detector_id: DetectorId | None = None,
) -> None:
    """Trigger the smart assignment feature off Seer RCA/PR start, issue assignment, and
    issue resolution.
    """
    try:
        activity_type = ActivityType(activity.type)
    except ValueError:
        return

    if activity_type not in _SMART_ASSIGNMENT_ACTIVITIES:
        return

    from sentry.seer.smart_assignment.trigger import trigger_smart_assignment

    trigger_smart_assignment(group, activity_type, activity)


@workflow_activity_registry.register("smart_assignment_completed")
def smart_assignment_completed_handler(
    group: Group,
    activity: Activity,
    detector_id: DetectorId | None = None,
) -> None:
    """Act on a delivered smart-assignment verdict.

    Responds to the SMART_ASSIGNMENT_COMPLETED activity created when when Seer
    returns a result. Records the prediction, maybe-scores it against ground truth
    (if we have it), creates a GroupOwner indicating a suggested owner, and promotes
    the suggestion to an assignment iff the project auto-assigns to owners.
    """
    try:
        activity_type = ActivityType(activity.type)
    except ValueError:
        return

    if activity_type != ActivityType.SMART_ASSIGNMENT_COMPLETED:
        return

    from sentry.seer.smart_assignment.completion import process_smart_assignment_completion

    process_smart_assignment_completion(group, activity)


@workflow_activity_registry.register("generic_activity")
def activity_handler(
    group: Group,
    activity: Activity,
    detector_id: DetectorId | None = None,
) -> None:
    """
    Generic handler for group status change activities.

    To add a new activity, add it to SUPPORTED_ACTIVITIES.
    Then, add a roll out flag after the supported activity filter.

    If there's a need for greater flexibility, create a new handler in the registry.
    But, these custom handlers will not have the platform metrics or logging.
    """
    logging_ctx = {
        "activity_type": activity.type,
        "group_id": group.id,
        "project_id": group.project_id,
    }

    try:
        activity_type = ActivityType(activity.type)
    except ValueError:
        logger.exception(
            "workflow_engine.activity_handler.invalid_activity_type",
            extra=logging_ctx,
        )
        return

    logging_ctx["activity_name"] = activity_type.name

    if activity_type not in SUPPORTED_ACTIVITIES:
        return

    event_data = WorkflowEventData(event=activity, group=group)

    try:
        if detector_id is not None:
            detector = Detector.objects.get(pk=detector_id)
        else:
            detector = get_preferred_detector(event_data=event_data)
    except Detector.DoesNotExist:
        logger.exception(
            "workflow_engine.activity_handler.missing_detector",
            extra=logging_ctx,
        )
        return

    logging_ctx["detector_id"] = detector.id
    logging_ctx["detector_type"] = detector.type

    process_workflow_activity.delay(
        activity_id=activity.id,
        group_id=group.id,
        detector_id=detector.id,
    )

    metrics.incr(
        "workflow_engine.activity_handler.complete",
        tags={
            "activity_name": activity_type.name,
            "detector_type": detector.type,
        },
    )
    logger.info(
        "workflow_engine.activity_handler.complete",
        extra=logging_ctx,
    )
