from dataclasses import asdict

from django.db.models import Value

from sentry.eventstream.base import GroupState
from sentry.models.activity import Activity
from sentry.services.eventstore.models import GroupEvent
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker import namespaces
from sentry.taskworker.retry import Retry
from sentry.utils import metrics
from sentry.utils.exceptions import timeout_grouping_context
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.tasks.utils import (
    build_workflow_event_data_from_activity,
    build_workflow_event_data_from_event,
)
from sentry.workflow_engine.types import WorkflowEventData
from sentry.workflow_engine.utils import log_context

logger = log_context.get_logger(__name__)


def build_trigger_action_task_params(
    action: Action,
    event_data: WorkflowEventData,
    workflow_uuid_map: dict[int, str],
) -> dict[str, object]:
    """
    Build parameters for trigger_action task invocation.

    Args:
        action: The action to trigger.
        event_data: The event data to use for the action.
        workflow_uuid_map: Mapping of workflow_id to notification_uuid.
    """
    event_id = None
    activity_id = None
    occurrence_id = None

    if isinstance(event_data.event, GroupEvent):
        event_id = event_data.event.event_id
        occurrence_id = event_data.event.occurrence_id
    elif isinstance(event_data.event, Activity):
        activity_id = event_data.event.id

    # workflow_id is annotated in the queryset by filter_recently_fired_workflow_actions
    workflow_id = getattr(action, "workflow_id", None)

    task_params = {
        "action_id": action.id,
        "workflow_id": workflow_id,
        "event_id": event_id,
        "activity_id": activity_id,
        "group_id": event_data.event.group_id,
        "occurrence_id": occurrence_id,
        "group_state": event_data.group_state,
        "has_reappeared": event_data.has_reappeared,
        "has_escalated": event_data.has_escalated,
    }

    # Add notification_uuid if available from workflow_uuid_map
    if workflow_id is not None and workflow_id in workflow_uuid_map:
        task_params["notification_uuid"] = workflow_uuid_map[workflow_id]

    return task_params


@instrumented_task(
    name="sentry.workflow_engine.tasks.trigger_action",
    namespace=namespaces.workflow_engine_tasks,
    processing_deadline_duration=30,
    retry=Retry(times=3, delay=5),
    silo_mode=SiloMode.REGION,
)
@retry(timeouts=True, raise_on_no_retries=False, ignore_and_capture=Action.DoesNotExist)
def trigger_action(
    action_id: int,
    workflow_id: int,
    event_id: str | None,
    activity_id: int | None,
    group_id: int,
    occurrence_id: str | None,
    group_state: GroupState,
    has_reappeared: bool,
    has_escalated: bool,
    detector_id: int | None = None,  # TODO: remove
    notification_uuid: str | None = None,
) -> None:
    import uuid

    from sentry.notifications.notification_action.utils import should_fire_workflow_actions
    from sentry.workflow_engine.processors.detector import get_detector_from_event_data

    # Generate UUID if not provided (handles version skew at task boundary)
    if notification_uuid is None:
        notification_uuid = str(uuid.uuid4())

    # XOR check to ensure exactly one of event_id or activity_id is provided
    if (event_id is not None) == (activity_id is not None):
        logger.error(
            "Exactly one of event_id or activity_id must be provided",
            extra={"event_id": event_id, "activity_id": activity_id},
        )
        raise ValueError("Exactly one of event_id or activity_id must be provided")

    action = Action.objects.annotate(workflow_id=Value(workflow_id)).get(id=action_id)

    if event_id is not None:
        event_data = build_workflow_event_data_from_event(
            event_id=event_id,
            group_id=group_id,
            workflow_id=workflow_id,
            occurrence_id=occurrence_id,
            group_state=group_state,
            has_reappeared=has_reappeared,
            has_escalated=has_escalated,
        )
    elif activity_id is not None:
        event_data = build_workflow_event_data_from_activity(
            activity_id=activity_id, group_id=group_id
        )
    else:
        # This should never happen, and if it does, need to investigate
        logger.error(
            "Exactly one of event_id or activity_id must be provided",
            extra={"event_id": event_id, "activity_id": activity_id},
        )
        raise ValueError("Exactly one of event_id or activity_id must be provided")

    detector = get_detector_from_event_data(event_data)

    metrics.incr(
        "workflow_engine.tasks.trigger_action_task_started",
        tags={"action_type": action.type, "detector_type": detector.type},
        sample_rate=1.0,
    )

    should_trigger_actions = should_fire_workflow_actions(
        detector.project.organization, event_data.group.type
    )

    if should_trigger_actions:
        # Set up a timeout grouping context because we want to make sure any Sentry timeout reporting
        # in this scope is grouped properly.
        with timeout_grouping_context(action.type):
            action.trigger(event_data, notification_uuid=notification_uuid)
    else:
        logger.info(
            "workflow_engine.triggered_actions.dry-run",
            extra={
                "action_ids": [action_id],
                "event_data": asdict(event_data),
            },
        )
