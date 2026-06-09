import logging

from sentry import features
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.processors.detector import get_preferred_detector
from sentry.workflow_engine.registry import workflow_activity_registry
from sentry.workflow_engine.tasks.workflows import process_workflow_activity
from sentry.workflow_engine.types import DetectorId, WorkflowEventData
from sentry.workflow_engine.utils import log_context, scopedstats

logger = logging.getLogger(__name__)

SUPPORTED_ACTIVITIES = [
    ActivityType.SET_RESOLVED,
]

SEER_WORKFLOW_ACTIVITIES = [
    ActivityType.SEER_RCA_STARTED,
    ActivityType.SEER_RCA_COMPLETED,
    ActivityType.SEER_SOLUTION_STARTED,
    ActivityType.SEER_SOLUTION_COMPLETED,
    ActivityType.SEER_CODING_STARTED,
    ActivityType.SEER_CODING_COMPLETED,
    ActivityType.SEER_PR_CREATED,
]


def get_detector_by_activity(activity: Activity, group: Group) -> Detector:
    event_data = WorkflowEventData(event=activity, group=group)

    try:
        detector = get_preferred_detector(event_data=event_data)
    except Detector.DoesNotExist:
        logger.exception("workflow_engine.seer_activity_handler.missing_detector")
        return

    return detector


def get_activity_type(activity) -> ActivityType:
    try:
        return ActivityType(activity.type)
    except ValueError:
        logger.exception("workflow_engine.seer_activity_handler.invalid_activity_type")


def set_log_level_for_org(organization: Organization) -> None:
    if features.has("organizations:workflow-engine-process-workflows-logs", organization):
        log_context.set_verbose(True)


@workflow_activity_registry.register("seer_activity")
@log_context.root()
def seer_activity_handler(group: Group, activity: Activity) -> None:
    activity_type = get_activity_type(activity.type)

    log_context.add_extras(
        activity_type=activity.type,
        group_id=group.id,
        project_id=group.project_id,
    )

    if activity_type not in SEER_WORKFLOW_ACTIVITIES:
        return

    has_seer_activities = features.has(
        "organizations:workflow-engine-evaluate-seer-activities",
        group.organization,
    )

    if not has_seer_activities:
        return

    detector = get_detector_by_activity(activity, group)

    set_log_level_for_org(group.organization)
    log_context.add_extras(
        activity_name=activity_type.name,
        detector_id=detector.id,
        detector_type=detector.type,
    )

    process_workflow_activity.delay(
        activity_id=activity.id,
        group_id=group.id,
        detector_id=detector.id,
    )

    logger.debug("workflow_engine.seer_activity_handler.complete")


@workflow_activity_registry.register("generic_activity_handler")
@log_context.root()
@scopedstats.timer()
def activity_handler(group: Group, activity: Activity, detector_id: DetectorId | None) -> None:
    activity_type = get_activity_type(activity.type)

    if activity_type not in SUPPORTED_ACTIVITIES:
        # we don't support that activity type, terminate early.
        return

    set_log_level_for_org(group.organization)

    log_context.add_extras(
        activity_type=activity.type,
        group_id=group.id,
        project_id=group.project_id,
    )

    if not detector_id:
        detector = get_detector_by_activity(activity, group)
        detector_id = detector.id

    process_workflow_activity.delay(
        activity_id=activity.id,
        group_id=group.id,
        detector_id=detector_id,
    )
