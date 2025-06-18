from sentry.issues.status_change_consumer import group_status_update_registry
from sentry.issues.status_change_message import StatusChangeMessageData
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker import config, namespaces, retry
from sentry.types.activity import ActivityType
from sentry.utils import metrics

SUPPORTED_ACTIVITIES = [ActivityType.SET_RESOLVED.value]


@instrumented_task(
    name="sentry.workflow_engine.processors.process_workflow_task",
    queue="process_workflows",
    default_retry_delay=5,
    max_retries=5,
    soft_time_limit=50,
    time_limit=60,
    silo_mode=SiloMode.REGION,
    taskworker_config=config.TaskworkerConfig(
        namespace=namespaces.workflow_engine_tasks,
        processing_deadline_duration=60,
        retry=retry.Retry(
            times=3,
            delay=5,
        ),
    ),
)
def process_workflow_task(activity_id: int, detector_id: int) -> None:
    """
    Process a workflow task identified by the given Activity ID and Detector ID.

    This task will retry up to 3 times with a delay of 5 seconds between attempts.
    It has a soft time limit of 50 seconds and a hard time limit of 60 seconds.

    The task will get the Activity from the database, create a WorkflowEventData object,
    and then process the data in `process_workflows`.
    """
    # TODO - @saponifi3d - implement this in a follow-up PR. This update will require WorkflowEventData
    # to allow for an activity in the `event` attribute. That refactor is a bit noisy
    # and will be done in a subsequent pr.
    pass


@group_status_update_registry.register("workflow_status_update")
def workflow_status_update_handler(
    group: Group, status_change_message: StatusChangeMessageData, activity: Activity
) -> None:
    """
    Hook the process_workflow_task into the activity creation registry.

    Since this handler is called in process for the activity, we want
    to queue a task to process workflows asynchronously.
    """
    if activity.type not in SUPPORTED_ACTIVITIES:
        # If the activity type is not supported, we do not need to process it.
        return

    detector_id = status_change_message.get("detector_id")

    if detector_id is None:
        # We should not hit this case, it's should only occur if there is a bug
        # passing it from the workflow_engine to the issue platform.
        metrics.incr("workflow_engine.error.tasks.no_detector_id")
        return

    # TODO - implement in follow-up PR for now, just track a metric that we are seeing the activities.
    # process_workflow_task.delay(activity.id, detector_id)
    metrics.incr(
        "workflow_engine.process_workflow.activity_update", tags={"activity_type": activity.type}
    )
