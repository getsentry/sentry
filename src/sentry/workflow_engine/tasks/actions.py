from django.db.models import Value

from sentry.eventstore.models import GroupEvent
from sentry.eventstream.base import GroupState
from sentry.models.activity import Activity
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker import config, namespaces
from sentry.taskworker.retry import Retry
from sentry.utils import metrics
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.tasks.utils import build_workflow_event_data_from_event
from sentry.workflow_engine.types import WorkflowEventData
from sentry.workflow_engine.utils import log_context

logger = log_context.get_logger(__name__)


def build_trigger_action_task_params(action, detector, event_data: WorkflowEventData):
    """Build parameters for trigger_action.delay() call."""
    event_id = None
    activity_id = None
    occurrence_id = None

    if isinstance(event_data.event, GroupEvent):
        event_id = event_data.event.event_id
        occurrence_id = event_data.event.occurrence_id
    elif isinstance(event_data.event, Activity):
        activity_id = event_data.event.id

    return {
        "action_id": action.id,
        "detector_id": detector.id,
        "workflow_id": getattr(action, "workflow_id", None),
        "event_id": event_id,
        "activity_id": activity_id,
        "group_id": event_data.event.group_id,
        "occurrence_id": occurrence_id,
        "group_state": event_data.group_state,
        "has_reappeared": event_data.has_reappeared,
        "has_escalated": event_data.has_escalated,
        "workflow_env_id": event_data.workflow_env.id if event_data.workflow_env else None,
    }


@instrumented_task(
    name="sentry.workflow_engine.tasks.trigger_action",
    queue="workflow_engine.trigger_action",
    acks_late=True,
    default_retry_delay=5,
    max_retries=3,
    soft_time_limit=25,
    time_limit=30,
    silo_mode=SiloMode.REGION,
    taskworker_config=config.TaskworkerConfig(
        namespace=namespaces.workflow_engine_tasks,
        processing_deadline_duration=30,
        retry=Retry(
            times=3,
            delay=5,
        ),
    ),
)
def trigger_action(
    action_id: int,
    detector_id: int,
    workflow_id: int,
    event_id: str | None,
    activity_id: int | None,
    group_id: int,
    occurrence_id: str | None,
    group_state: GroupState,
    has_reappeared: bool,
    has_escalated: bool,
    workflow_env_id: int | None,
) -> None:

    # XOR check to ensure exactly one of event_id or activity_id is provided
    if (event_id is not None) != (activity_id is not None):
        logger.error(
            "Exactly one of event_id or activity_id must be provided",
            extra={"event_id": event_id, "activity_id": activity_id},
        )
        raise ValueError("Exactly one of event_id or activity_id must be provided")

    # Fetch the action and detector
    action = Action.objects.annotate(workflow_id=Value(workflow_id)).get(id=action_id)
    detector = Detector.objects.get(id=detector_id)

    project_id = detector.project_id

    if event_id is not None:
        event_data = build_workflow_event_data_from_event(
            project_id=project_id,
            event_id=event_id,
            group_id=group_id,
            occurrence_id=occurrence_id,
            group_state=group_state,
            has_reappeared=has_reappeared,
            has_escalated=has_escalated,
            workflow_env_id=workflow_env_id,
        )
    else:
        # Here, we probably build the event data from the activity
        raise NotImplementedError("Activity ID is not supported yet")

    action.trigger(event_data, detector)

    metrics.incr(
        "workflow_engine.tasks.trigger_action_task_executed",
        tags={"action_type": action.type},
        sample_rate=1.0,
    )

    logger.info(
        "workflow_engine.trigger_workflow_action.success",
        extra={
            "action_id": action_id,
            "detector_id": detector_id,
            "workflow_id": workflow_id,
            "event_id": event_id,
        },
    )
