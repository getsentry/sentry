import logging

from sentry import features
from sentry.issues.activity_registry import group_activity_registry
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.types.activity import ActivityType
from sentry.utils import metrics

logger = logging.getLogger(__name__)

SUPPORTED_WORKFLOW_ACTIVITIES = [
    ActivityType.SEER_RCA_STARTED.value,
    ActivityType.SEER_RCA_COMPLETED.value,
    ActivityType.SEER_SOLUTION_STARTED.value,
    ActivityType.SEER_SOLUTION_COMPLETED.value,
    ActivityType.SEER_CODING_STARTED.value,
    ActivityType.SEER_CODING_COMPLETED.value,
    ActivityType.SEER_PR_CREATED.value,
]


@group_activity_registry.register("workflow_activity")
def workflow_activity_handler(group: Group, activity: Activity) -> None:
    from sentry.workflow_engine.models import Detector
    from sentry.workflow_engine.tasks.workflows import process_workflow_activity

    metrics.incr(
        "workflow_engine.tasks.process_workflows.activity_created",
        tags={"activity_type": activity.type},
    )

    if activity.type not in SUPPORTED_WORKFLOW_ACTIVITIES:
        return

    if not features.has(
        "organizations:workflow-engine-evaluate-seer-activities", group.organization
    ):
        return

    try:
        detector = Detector.get_issue_stream_detector_for_project(group.project_id)
    except Detector.DoesNotExist:
        metrics.incr("workflow_engine.tasks.error.no_issue_stream_detector")
        logger.error(
            "Issue stream detector not found for project",
            extra={"project_id": group.project_id, "group_id": group.id},
        )
        return

    process_workflow_activity.delay(
        activity_id=activity.id,
        group_id=group.id,
        detector_id=detector.id,
    )
