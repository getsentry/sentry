from google.api_core.exceptions import DeadlineExceeded, RetryError, ServiceUnavailable

from sentry import nodestore
from sentry.eventstream.base import GroupState
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.activity import Activity
from sentry.models.environment import Environment
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.tasks.post_process import update_event_group
from sentry.types.activity import ActivityType
from sentry.utils import metrics
from sentry.utils.retries import ConditionalRetryPolicy, exponential_delay
from sentry.workflow_engine.models.workflow import Workflow
from sentry.workflow_engine.types import WorkflowEventData
from sentry.workflow_engine.utils import log_context, scopedstats

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
    with metrics.timer("workflow_engine.process_workflows.fetch_from_nodestore"):
        data = fetch_retry_policy(lambda: nodestore.backend.get(node_id))
    if data is None:
        return None
    evt = Event(
        event_id=event_id,
        project_id=project_id,
        data=data,
    )
    project = Project.objects.get_from_cache(id=project_id)
    project.set_cached_field_value(
        "organization", Organization.objects.get_from_cache(id=project.organization_id)
    )
    evt.project = project
    return evt


class EventNotFoundError(Exception):
    def __init__(self, event_id: str, project_id: int):
        msg = f"Event not found: event_id={event_id}, project_id={project_id}"
        super().__init__(msg)


@scopedstats.timer()
def build_workflow_event_data_from_event(
    event_id: str,
    group_id: int,
    workflow_id: int | None = None,
    occurrence_id: str | None = None,
    group_state: GroupState | None = None,
    has_reappeared: bool = False,
    has_escalated: bool = False,
) -> WorkflowEventData:
    """
    Build a WorkflowEventData object from individual parameters.
    This method handles all the database fetching and object construction logic.
    Raises EventNotFoundError if the event is not found.
    """
    group = Group.objects.get_from_cache(id=group_id)
    project_id = group.project_id
    event = fetch_event(event_id, project_id)
    if event is None:
        raise EventNotFoundError(event_id, project_id)

    occurrence = IssueOccurrence.fetch(occurrence_id, project_id) if occurrence_id else None

    if group_state:
        group_event = update_event_group(event, group_state)
        group = group_event.group
    else:
        group_event = GroupEvent.from_event(event, group)
    group_event.occurrence = occurrence

    # Fetch environment from workflow, if provided
    workflow_env: Environment | None = None
    if workflow_id:
        workflow_env = (
            Workflow.objects.filter(id=workflow_id).select_related("environment").get().environment
        )

    return WorkflowEventData(
        event=group_event,
        group=group,
        group_state=group_state,
        has_reappeared=has_reappeared,
        has_escalated=has_escalated,
        workflow_env=workflow_env,
    )


def build_workflow_event_data_from_activity(
    activity_id: int,
    group_id: int,
) -> WorkflowEventData:

    activity = Activity.objects.get(id=activity_id)
    group = Group.objects.get(id=group_id)

    return WorkflowEventData(
        event=activity,
        group=group,
    )
