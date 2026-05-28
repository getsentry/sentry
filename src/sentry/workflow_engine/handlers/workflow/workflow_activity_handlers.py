import logging

from sentry import features
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.types.activity import ActivityType
from sentry.utils import metrics
from sentry.workflow_engine.registry import workflow_activity_registry

logger = logging.getLogger(__name__)

SEER_WORKFLOW_ACTIVITIES = [
    ActivityType.SEER_RCA_STARTED.value,
    ActivityType.SEER_RCA_COMPLETED.value,
    ActivityType.SEER_SOLUTION_STARTED.value,
    ActivityType.SEER_SOLUTION_COMPLETED.value,
    ActivityType.SEER_CODING_STARTED.value,
    ActivityType.SEER_CODING_COMPLETED.value,
    ActivityType.SEER_PR_CREATED.value,
]


@workflow_activity_registry.register("seer_activity")
def seer_activity_handler(group: Group, activity: Activity) -> None:
    from sentry.workflow_engine.models import Detector
    from sentry.workflow_engine.tasks.workflows import process_workflow_activity

    if activity.type not in SEER_WORKFLOW_ACTIVITIES:
        return

    if not features.has(
        "organizations:workflow-engine-evaluate-seer-activities", group.organization
    ):
        return

    try:
        activity_name = ActivityType(activity.type).name
    except ValueError:
        activity_name = "unknown"

    logging_ctx = {
        "activity_type": activity.type,
        "activity_name": activity_name,
        "group_id": group.id,
        "project_id": group.project_id,
    }

    try:
        detector = Detector.get_issue_stream_detector_for_project(group.project_id)
    except Detector.DoesNotExist:
        logger.error(
            "workflow_engine.seer_activity_handler.missing_detector",
            extra=logging_ctx,
            exc_info=True,
        )
        return

    process_workflow_activity.delay(
        activity_id=activity.id,
        group_id=group.id,
        detector_id=detector.id,
    )
    metrics.incr("workflow_engine.seer_activity_handler", tags={"activity_name": activity_name})
    logger.info("workflow_engine.seer_activity_handler.success", extra=logging_ctx)
