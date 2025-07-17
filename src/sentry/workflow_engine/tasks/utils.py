from functools import wraps

import sentry_sdk
from google.api_core.exceptions import DeadlineExceeded, RetryError, ServiceUnavailable

from sentry import nodestore
from sentry.eventstore.models import Event, GroupEvent
from sentry.eventstream.base import GroupState
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.environment import Environment
from sentry.models.group import Group
from sentry.taskworker.retry import retry_task
from sentry.taskworker.workerchild import ProcessingDeadlineExceeded
from sentry.types.activity import ActivityType
from sentry.utils.retries import ConditionalRetryPolicy, exponential_delay
from sentry.workflow_engine.types import WorkflowEventData
from sentry.workflow_engine.utils import log_context

SUPPORTED_ACTIVITIES = [ActivityType.SET_RESOLVED.value]


logger = log_context.get_logger(__name__)


def _should_retry_nodestore_fetch(attempt: int, e: Exception) -> bool:
    return not attempt > 3 and (
        # ServiceUnavailable and DeadlineExceeded are generally retriable;
        # we also include RetryError because the nodestore interface doesn't let
        # us specify a timeout to BigTable and the default is 5s; see c5e2b40.
        isinstance(e, (ServiceUnavailable, RetryError, DeadlineExceeded))
    )


def fetch_event(event_id: str, project_id: int) -> Event | None:
    """
    Fetch a single Event, with retries.
    """
    node_id = Event.generate_node_id(project_id, event_id)
    fetch_retry_policy = ConditionalRetryPolicy(
        _should_retry_nodestore_fetch, exponential_delay(1.00)
    )
    data = fetch_retry_policy(lambda: nodestore.backend.get(node_id))
    if data is None:
        return None
    return Event(
        event_id=event_id,
        project_id=project_id,
        data=data,
    )


def build_workflow_event_data_from_event(
    project_id: int,
    event_id: str,
    group_id: int,
    occurrence_id: str | None = None,
    group_state: GroupState | None = None,
    has_reappeared: bool = False,
    has_escalated: bool = False,
    workflow_env_id: int | None = None,
) -> WorkflowEventData:
    """
    Build a WorkflowEventData object from individual parameters.
    This method handles all the database fetching and object construction logic.
    """

    event = fetch_event(event_id, project_id)
    if event is None:
        raise ValueError(f"Event not found: event_id={event_id}, project_id={project_id}")

    occurrence = IssueOccurrence.fetch(occurrence_id, project_id) if occurrence_id else None
    # TODO(iamrajjoshi): Should we use get_from_cache here?
    group = Group.objects.get(id=group_id)
    group_event = GroupEvent.from_event(event, group)
    group_event.occurrence = occurrence

    # Fetch environment if provided
    workflow_env = None
    if workflow_env_id:
        workflow_env = Environment.objects.get(id=workflow_env_id)

    return WorkflowEventData(
        event=group_event,
        group=group,
        group_state=group_state,
        has_reappeared=has_reappeared,
        has_escalated=has_escalated,
        workflow_env=workflow_env,
    )


def retry_timeouts(func):
    """
    Schedule a task retry if the function raises ProcessingDeadlineExceeded.
    This exists because the standard retry decorator doesn't allow BaseExceptions.
    """

    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except ProcessingDeadlineExceeded:
            sentry_sdk.capture_exception(level="info")
            retry_task()

    return wrapper
