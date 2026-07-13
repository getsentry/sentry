import logging

from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.types.activity import ActivityType
from sentry.utils import metrics
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.processors.detector import get_preferred_detector
from sentry.workflow_engine.registry import workflow_activity_registry
from sentry.workflow_engine.tasks.workflows import process_workflow_activity
from sentry.workflow_engine.types import DetectorId, WorkflowEventData

logger = logging.getLogger(__name__)

SEER_WORKFLOW_ACTIVITIES = [
    ActivityType.SEER_RCA_STARTED,
    ActivityType.SEER_RCA_COMPLETED,
    ActivityType.SEER_SOLUTION_STARTED,
    ActivityType.SEER_SOLUTION_COMPLETED,
    ActivityType.SEER_CODING_STARTED,
    ActivityType.SEER_CODING_COMPLETED,
    ActivityType.SEER_PR_CREATED,
    ActivityType.SEER_ITERATION_STARTED,
    ActivityType.SEER_ITERATION_COMPLETED,
]

# Activity types handled by the generic activity_handler.
SUPPORTED_ACTIVITIES = [
    ActivityType.SET_RESOLVED,
    ActivityType.SET_RESOLVED_IN_RELEASE,
    ActivityType.SET_RESOLVED_BY_AGE,
    ActivityType.SET_RESOLVED_IN_COMMIT,
    ActivityType.SET_RESOLVED_IN_PULL_REQUEST,
]

# Activities the smart assignment feature reacts to: Seer opening a PR, an
# assignment, or a resolution. Each triggers a prediction (deduped to one per
# group) and records ground truth; gating lives in maybe_trigger_smart_assignment.
# SET_RESOLVED_BY_AGE is intentionally excluded: it's always the auto-resolve cron
# (no acting user), so it carries no signal and would only ever be filtered out.
_SMART_ASSIGNMENT_ACTIVITIES = frozenset(
    {
        ActivityType.SEER_PR_CREATED,
        ActivityType.ASSIGNED,
        ActivityType.SET_RESOLVED,
        ActivityType.SET_RESOLVED_IN_RELEASE,
        ActivityType.SET_RESOLVED_IN_COMMIT,
        ActivityType.SET_RESOLVED_IN_PULL_REQUEST,
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


@workflow_activity_registry.register("smart_assignment")
def smart_assignment_activity_handler(
    group: Group,
    activity: Activity,
    detector_id: DetectorId | None = None,
) -> None:
    """Trigger the smart assignment feature off Seer PRs, assignment, and resolution.

    Invoked unconditionally for every group activity (via
    invoke_workflow_activity_handlers), so it self-filters to the activities we care
    about and delegates gating, dispatch (deduped to one run per group), and
    ground-truth capture to maybe_trigger_smart_assignment.
    """
    try:
        activity_type = ActivityType(activity.type)
    except ValueError:
        return

    if activity_type not in _SMART_ASSIGNMENT_ACTIVITIES:
        return

    from sentry.seer.models.smart_assignment import SmartAssignmentTrigger
    from sentry.seer.smart_assignment.trigger import maybe_trigger_smart_assignment

    if activity_type == ActivityType.SEER_PR_CREATED:
        trigger = SmartAssignmentTrigger.PR_CREATED
    elif activity_type == ActivityType.ASSIGNED:
        trigger = SmartAssignmentTrigger.ASSIGNMENT
    else:
        trigger = SmartAssignmentTrigger.RESOLUTION

    maybe_trigger_smart_assignment(group, trigger, activity)


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
