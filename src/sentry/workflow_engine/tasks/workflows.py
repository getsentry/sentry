from django.db import router, transaction

from sentry import features
from sentry.eventstream.base import GroupState
from sentry.issues.status_change_consumer import group_status_update_registry
from sentry.issues.status_change_message import StatusChangeMessageData
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker import config, namespaces
from sentry.taskworker.retry import Retry
from sentry.types.activity import ActivityType
from sentry.utils import metrics
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.processors.workflow import process_workflows
from sentry.workflow_engine.tasks.utils import build_workflow_event_data_from_event
from sentry.workflow_engine.types import WorkflowEventData
from sentry.workflow_engine.utils import log_context

SUPPORTED_ACTIVITIES = [ActivityType.SET_RESOLVED.value]

logger = log_context.get_logger(__name__)


@instrumented_task(
    name="sentry.workflow_engine.tasks.process_workflow_activity",
    queue="workflow_engine.process_workflows",
    acks_late=True,
    default_retry_delay=5,
    max_retries=3,
    soft_time_limit=50,
    time_limit=60,
    silo_mode=SiloMode.REGION,
    taskworker_config=config.TaskworkerConfig(
        namespace=namespaces.workflow_engine_tasks,
        processing_deadline_duration=60,
        retry=Retry(
            times=3,
            delay=5,
        ),
    ),
)
@retry
def process_workflow_activity(activity_id: int, group_id: int, detector_id: int) -> None:
    """
    Process a workflow task identified by the given activity, group, and detector.

    The task will get the Activity from the database, create a WorkflowEventData object,
    and then process the data in `process_workflows`.
    """
    with transaction.atomic(router.db_for_write(Detector)):
        try:
            activity = Activity.objects.get(id=activity_id)
            group = Group.objects.get(id=group_id)
            detector = Detector.objects.get(id=detector_id)
        except (Activity.DoesNotExist, Group.DoesNotExist, Detector.DoesNotExist):
            logger.exception(
                "Unable to fetch data to process workflow activity",
                extra={
                    "activity_id": activity_id,
                    "group_id": group_id,
                    "detector_id": detector_id,
                },
            )
            return  # Exit execution that we cannot recover from

    event_data = WorkflowEventData(
        event=activity,
        group=group,
    )

    process_workflows(event_data, detector)
    metrics.incr(
        "workflow_engine.process_workflow.activity_update.executed",
        tags={"activity_type": activity.type},
    )


@group_status_update_registry.register("workflow_status_update")
def workflow_status_update_handler(
    group: Group, status_change_message: StatusChangeMessageData, activity: Activity
) -> None:
    """
    Hook the process_workflow_task into the activity creation registry.

    Since this handler is called in process for the activity, we want
    to queue a task to process workflows asynchronously."""
    metrics.incr(
        "workflow_engine.process_workflow.activity_update", tags={"activity_type": activity.type}
    )
    if activity.type not in SUPPORTED_ACTIVITIES:
        # If the activity type is not supported, we do not need to process it.
        return

    detector_id = status_change_message.get("detector_id")

    if detector_id is None:
        # We should not hit this case, it's should only occur if there is a bug
        # passing it from the workflow_engine to the issue platform.
        metrics.incr("workflow_engine.error.tasks.no_detector_id")
        return

    if features.has("organizations:workflow-engine-process-activity", group.organization):
        process_workflow_activity.delay(
            activity_id=activity.id,
            group_id=group.id,
            detector_id=detector_id,
        )


@instrumented_task(
    name="sentry.workflow_engine.tasks.process_workflows_event",
    queue="workflow_engine.process_workflows",
    acks_late=True,
    default_retry_delay=5,
    max_retries=3,
    soft_time_limit=50,
    time_limit=60,
    silo_mode=SiloMode.REGION,
    taskworker_config=config.TaskworkerConfig(
        namespace=namespaces.workflow_engine_tasks,
        processing_deadline_duration=60,
        retry=Retry(
            times=3,
            delay=5,
        ),
    ),
)
@retry
def process_workflows_event(
    project_id: int,
    event_id: str,
    group_id: int,
    occurrence_id: str | None,
    group_state: GroupState,
    has_reappeared: bool,
    has_escalated: bool,
    **kwargs,
) -> None:

    event_data = build_workflow_event_data_from_event(
        project_id=project_id,
        event_id=event_id,
        group_id=group_id,
        occurrence_id=occurrence_id,
        group_state=group_state,
        has_reappeared=has_reappeared,
        has_escalated=has_escalated,
    )
    process_workflows(event_data)

    metrics.incr("workflow_engine.tasks.process_workflow_task_executed", sample_rate=1.0)
