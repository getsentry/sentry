from sentry.models.activity import Activity, activity_creation_registry
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker import config, namespaces, retry


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
def process_workflow_task(activity_id: int) -> None:
    """
    Process a workflow task identified by the given activity ID.

    This task will retry up to 3 times with a delay of 5 seconds between attempts.
    It has a soft time limit of 50 seconds and a hard time limit of 60 seconds.

    The task will get the Activity from the database, create a WorkflowEventData object,
    and then process the data in `process_workflows`.
    """
    # TODO implement this in a follow-up PR. This update will require a lot of updates...
    pass


@activity_creation_registry.register("workflow_status_update")
def workflow_status_update_handler(activity: Activity) -> None:
    """
    Hook the process_workflow_task into the activity creation registry.

    Since this handler is called in process for the activity, we want
    to queue a task to process workflows asynchronously.
    """
    # TODO implement this in a follow-up PR.
    # process_workflow_task.delay(activity.id)
    pass
