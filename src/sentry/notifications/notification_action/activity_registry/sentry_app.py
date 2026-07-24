from enum import StrEnum
from typing import Any, NotRequired, TypedDict

from sentry.api.serializers import serialize
from sentry.constants import SentryAppInstallationStatus
from sentry.models.activity import Activity
from sentry.models.organization import Organization
from sentry.notifications.notification_action.activity_registry.base import require_config
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.notifications.notification_action.types import ActivityHandler
from sentry.notifications.platform.templates.activity.base import (
    extract_notification_models_by_activity,
)
from sentry.sentry_apps.event_types import SentryAppEventType
from sentry.sentry_apps.metrics import (
    SentryAppInteractionEvent,
    SentryAppInteractionType,
)
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.services.app.model import RpcSentryAppInstallation
from sentry.sentry_apps.tasks.sentry_apps import WebhookGroupResponse, _webhook_issue_data
from sentry.types.activity import SEER_ACTIVITY_TYPES, STATUS_CHANGE_ACTIVITY_TYPES
from sentry.users.services.user.service import user_service
from sentry.utils import json
from sentry.workflow_engine.models import Action, Workflow
from sentry.workflow_engine.types import ActionInvocation

REGISTERED_SENTRY_APP_ACTIVITY_TYPES = [*SEER_ACTIVITY_TYPES, *STATUS_CHANGE_ACTIVITY_TYPES]


class ActivityAlertType(StrEnum):
    SEER_RCA_STARTED = "seer_root_cause_started"
    SEER_RCA_COMPLETED = "seer_root_cause_completed"
    SEER_SOLUTION_STARTED = "seer_solution_started"
    SEER_SOLUTION_COMPLETED = "seer_solution_completed"
    SEER_CODING_STARTED = "seer_coding_started"
    SEER_CODING_COMPLETED = "seer_coding_completed"
    SEER_PR_CREATED = "seer_pr_created"
    SEER_ITERATION_STARTED = "seer_pr_iteration_started"
    SEER_ITERATION_COMPLETED = "seer_pr_iteration_completed"
    SET_RESOLVED = "status_resolved"
    SET_UNRESOLVED = "status_unresolved"
    SET_IGNORED = "status_ignored"
    SET_REGRESSION = "status_regression"
    SET_RESOLVED_IN_RELEASE = "status_resolved_in_release"
    SET_RESOLVED_BY_AGE = "status_resolved_by_age"
    SET_RESOLVED_IN_COMMIT = "status_resolved_in_commit"
    # This ActivityType is sort of a misnomer, since it is created when a pull request links to the
    # group, and has nothing to do with resolving it.
    SET_RESOLVED_IN_PULL_REQUEST = "appeared_in_pull_request"
    SET_ESCALATING = "status_escalating"


ACTIVITY_TYPE_TO_ACTIVITY_ALERT_TYPE: dict[int, ActivityAlertType] = {
    at.value: ActivityAlertType[at.name] for at in REGISTERED_SENTRY_APP_ACTIVITY_TYPES
}


class ActivityData(TypedDict):
    type: ActivityAlertType
    details: dict[str, Any]


class WorkflowData(TypedDict):
    id: int
    title: str
    sentry_app_id: int
    url: str
    web_url: str
    settings: NotRequired[list[dict[str, Any]]]


class ActivityAlertWebhookPayload(TypedDict):
    issue: WebhookGroupResponse
    activity: ActivityData
    alert: WorkflowData


def _get_sentry_app_installation(
    action: Action, organization: Organization
) -> RpcSentryAppInstallation:
    target_identifier = require_config(action, "target_identifier")

    if action.type == Action.Type.SENTRY_APP:
        installations = app_service.get_many(
            filter=dict(
                app_ids=[int(target_identifier)],
                organization_id=organization.id,
                status=SentryAppInstallationStatus.INSTALLED,
            )
        )
    else:
        sentry_app = app_service.get_sentry_app_by_slug(slug=target_identifier)
        if not sentry_app:
            raise ValueError(f"Sentry app not found: {target_identifier}")
        installations = app_service.get_many(
            filter=dict(
                app_ids=[sentry_app.id],
                organization_id=organization.id,
                status=SentryAppInstallationStatus.INSTALLED,
            )
        )

    if not installations or len(installations) != 1:
        raise ValueError(f"Expected 1 sentry app installation, got {len(installations)}")
    return installations[0]


def _build_activity_data(activity: Activity) -> ActivityData:
    activity_alert_type = ACTIVITY_TYPE_TO_ACTIVITY_ALERT_TYPE.get(activity.type)
    if activity_alert_type is None:
        raise ValueError(f"Unrecognized activity type: {activity.type} for activity {activity.id}")

    details: dict[str, Any] = {}

    if activity.user_id:
        if user := user_service.get_user(user_id=activity.user_id):
            details["user"] = {
                "id": user.id,
                "name": user.get_display_name(),
                "username": user.username,
            }

    if not activity.data:
        return ActivityData(type=activity_alert_type, details=details)

    match activity_alert_type:
        case ActivityAlertType.SEER_RCA_COMPLETED | ActivityAlertType.SEER_SOLUTION_COMPLETED:
            summary = activity.data.get("summary", "")
            details["summary"] = summary
        case ActivityAlertType.SEER_PR_CREATED:
            pull_requests_data = activity.data.get("pull_requests", [])
            pull_requests = [
                {
                    "repo_name": pull_request.get("repo_name"),
                    "url": pull_request.get("pull_request", {}).get("pr_url"),
                }
                for pull_request in pull_requests_data
            ]
            details["pull_requests"] = pull_requests
        case ActivityAlertType.SEER_ITERATION_COMPLETED:
            pull_requests_data = activity.data.get("pull_requests", [])
            if pull_requests_data:
                details["pull_requests"] = [
                    {
                        "repo_name": pr.get("repo_name"),
                        "url": pr.get("pull_request", {}).get("pr_url"),
                    }
                    for pr in pull_requests_data
                ]
            code_changes = activity.data.get("code_changes")
            if code_changes:
                details["code_changes"] = code_changes
            iteration_index = activity.data.get("iteration_index")
            if iteration_index is not None:
                details["iteration_index"] = iteration_index
    return ActivityData(type=activity_alert_type, details=details)


def _build_workflow_data(
    invocation: ActionInvocation, organization: Organization, install: RpcSentryAppInstallation
) -> WorkflowData:
    try:
        workflow = Workflow.objects.get(id=invocation.workflow_id, organization_id=organization.id)
    except Workflow.DoesNotExist:
        raise ValueError(f"Workflow not found: {invocation.workflow_id}")

    workflow_data = WorkflowData(
        id=workflow.id,
        title=workflow.name,
        sentry_app_id=install.sentry_app.id,
        url=organization.absolute_api_url(f"workflows/{workflow.id}/"),
        web_url=organization.absolute_url(
            f"organizations/{organization.slug}/monitors/alerts/{workflow.id}/"
        ),
    )

    settings = invocation.action.data.get("settings")
    if settings:
        workflow_data["settings"] = settings

    return workflow_data


@activity_handler_registry.register(Action.Type.SENTRY_APP)
@activity_handler_registry.register(Action.Type.WEBHOOK)
class SentryAppActivityHandler(ActivityHandler):
    compatible_activity_types = REGISTERED_SENTRY_APP_ACTIVITY_TYPES

    @classmethod
    def invoke_action(cls, invocation: ActionInvocation, activity: Activity) -> None:
        from sentry.sentry_apps.tasks.sentry_apps import send_activity_alert_webhook

        with SentryAppInteractionEvent(
            operation_type=SentryAppInteractionType.PREPARE_WEBHOOK,
            event_type=SentryAppEventType.ACTIVITY_ALERT_TRIGGERED,
        ).capture() as lifecycle:
            lifecycle.add_extras(
                {
                    "activity_id": activity.id,
                    "activity_type": activity.type,
                    "action_id": invocation.action.id,
                    "action_type": invocation.action.type,
                }
            )
            action = invocation.action
            group, project, organization = extract_notification_models_by_activity(activity)
            lifecycle.add_extras(
                {
                    "group_id": group.id,
                    "project_id": project.id,
                    "organization_id": organization.id,
                }
            )

            install = _get_sentry_app_installation(action, organization)
            payload = ActivityAlertWebhookPayload(
                issue=_webhook_issue_data(group=group, serialized_group=serialize(group)),
                activity=_build_activity_data(activity=activity),
                alert=_build_workflow_data(
                    invocation=invocation, organization=organization, install=install
                ),
            )

        send_activity_alert_webhook.delay(
            sentry_app_id=install.sentry_app.id,
            organization_id=organization.id,
            payload_json=json.dumps(payload),
        )
