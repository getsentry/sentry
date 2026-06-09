import logging

from sentry.models.activity import Activity
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.templates.workflow_engine import WorkflowEngineActivityAction
from sentry.notifications.platform.types import NotificationTarget
from sentry.types.activity import ActivityType
from sentry.utils.http import absolute_uri
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation

logger = logging.getLogger(__name__)


NOTIFICATION_PLATFORM_COMPATIBLE_ACTIVITIES = [
    ActivityType.SEER_RCA_STARTED,
    ActivityType.SEER_RCA_COMPLETED,
    ActivityType.SEER_SOLUTION_STARTED,
    ActivityType.SEER_SOLUTION_COMPLETED,
    ActivityType.SEER_CODING_STARTED,
    ActivityType.SEER_CODING_COMPLETED,
    ActivityType.SEER_PR_CREATED,
]


def build_activity_data(
    invocation: ActionInvocation, activity: Activity
) -> WorkflowEngineActivityAction:
    detector = invocation.detector
    organization = detector.project.organization
    group = invocation.event_data.group

    group_url = None
    if group:
        group_url = absolute_uri(group.get_absolute_url())

    return WorkflowEngineActivityAction(
        workflow_id=invocation.workflow_id,
        activity_type=activity.type,
        activity_details=activity.data or {},
        notification_uuid=invocation.notification_uuid,
        organization_id=organization.id,
        project_id=detector.project_id,
        group_id=group.id if group else None,
        group_url=group_url,
        detector_id=detector.id,
    )


def send_activity_notification(
    invocation: ActionInvocation,
    activity: Activity,
    target: NotificationTarget,
) -> None:
    data = build_activity_data(invocation, activity)
    NotificationService[WorkflowEngineActivityAction](data=data).notify_sync(targets=[target])


def require_config(action: Action, key: str) -> str:
    value = action.config.get(key)
    if not value:
        raise ValueError(f"No {key} for action {action.id}")
    return value


def require_integration_id(action: Action) -> int:
    if action.integration_id is None:
        raise ValueError(f"No integration_id for action {action.id}")
    return action.integration_id
