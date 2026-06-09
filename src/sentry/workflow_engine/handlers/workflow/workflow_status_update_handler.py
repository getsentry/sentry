import logging

from sentry import features
from sentry.issues.status_change_consumer import group_status_update_registry
from sentry.issues.status_change_message import StatusChangeMessageData
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.types.activity import ActivityType
from sentry.utils import metrics

logger = logging.getLogger(__name__)

SEER_ACTIVITIES = [
    ActivityType.SEER_RCA_STARTED.value,
    ActivityType.SEER_RCA_COMPLETED.value,
    ActivityType.SEER_SOLUTION_STARTED.value,
    ActivityType.SEER_SOLUTION_COMPLETED.value,
    ActivityType.SEER_CODING_STARTED.value,
    ActivityType.SEER_CODING_COMPLETED.value,
    ActivityType.SEER_PR_CREATED.value,
]

SUPPORTED_ACTIVITIES = [
    ActivityType.SET_RESOLVED.value,
    *SEER_ACTIVITIES,
]


@group_status_update_registry.register("workflow_status_update")
def workflow_status_update_handler(
    group: Group,
    status_change_message: StatusChangeMessageData,
    activity: Activity,
) -> None:
    """
    Hook the process_workflow_task into the activity creation registry.

    Since this handler is called in process for the activity, we want
    to queue a task to process workflows asynchronously.
    """

    from sentry.workflow_engine.tasks.workflows import process_workflow_activity

    metrics.incr(
        "workflow_engine.tasks.process_workflows.activity_update",
        tags={"activity_type": activity.type},
    )
    if activity.type not in SUPPORTED_ACTIVITIES:
        # If the activity type is not supported, we do not need to process it.
        return

    detector_id = status_change_message.get("detector_id")

    if detector_id is None:
        # We should not hit this case, it's should only occur if there is a bug
        # passing it from the workflow_engine to the issue platform.
        metrics.incr(
            "workflow_engine.tasks.error.no_detector_id",
            tags={"activity_type": activity.type},
        )
        return

    organization = Organization.objects.get_from_cache(pk=activity.project.organization_id)

    if activity.type == ActivityType.SET_RESOLVED.value and features.has(
        "organizations:workflow-engine-status-change-via-activity", organization
    ):
        # The generic activity_handler (invoked via create_group_activity) now owns
        # status change activities. Skip here to avoid queuing the task twice.
        return

    can_process_seer_activities = features.has(
        "organizations:workflow-engine-evaluate-seer-activities", organization
    )

    if activity.type in SEER_ACTIVITIES and not can_process_seer_activities:
        # Don't process these activities yet
        # If the processing is enabled, then it's ok because no workflows can be triggered
        return

    process_workflow_activity.delay(
        activity_id=activity.id,
        group_id=group.id,
        detector_id=detector_id,
    )
