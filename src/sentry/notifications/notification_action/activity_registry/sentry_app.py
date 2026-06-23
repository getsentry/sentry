from typing import Any, TypedDict

from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import BaseGroupSerializerResponse
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.notifications.notification_action.activity_registry.base import (
    NOTIFICATION_PLATFORM_COMPATIBLE_ACTIVITIES,
    extract_models,
    require_config,
)
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.notifications.notification_action.types import ActivityHandler
from sentry.sentry_apps.api.serializers.app_platform_event import AppPlatformEvent
from sentry.sentry_apps.metrics import (
    SentryAppEventType,
    SentryAppInteractionEvent,
    SentryAppInteractionType,
)
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.services.app.model import RpcSentryAppInstallation
from sentry.sentry_apps.utils.webhooks import (
    ActivityAlertActionType,
    IssueAlertActionType,
    SentryAppResourceType,
)
from sentry.types.activity import ActivityType
from sentry.utils.sentry_apps.webhooks import send_and_save_webhook_request
from sentry.workflow_engine.models import Action, Workflow
from sentry.workflow_engine.types import ActionInvocation

ACTIVITY_TYPE_TO_ACTION_TYPE: dict[int, ActivityAlertActionType] = {
    ActivityType.SEER_RCA_STARTED.value: ActivityAlertActionType.SEER_RCA_STARTED,
    ActivityType.SEER_RCA_COMPLETED.value: ActivityAlertActionType.SEER_RCA_COMPLETED,
    ActivityType.SEER_SOLUTION_STARTED.value: ActivityAlertActionType.SEER_SOLUTION_STARTED,
    ActivityType.SEER_SOLUTION_COMPLETED.value: ActivityAlertActionType.SEER_SOLUTION_COMPLETED,
    ActivityType.SEER_CODING_STARTED.value: ActivityAlertActionType.SEER_CODING_STARTED,
    ActivityType.SEER_CODING_COMPLETED.value: ActivityAlertActionType.SEER_CODING_COMPLETED,
    ActivityType.SEER_PR_CREATED.value: ActivityAlertActionType.SEER_PR_CREATED,
}


class IssueData(BaseGroupSerializerResponse):
    url: str
    webUrl: str


class ActivityData(TypedDict):
    type: str  # str(ActivityAlertActionType)
    details: dict[str, Any]


class WorkflowData(TypedDict):
    id: int
    name: str
    url: str


class ActivityAlertWebhookPayload(TypedDict):
    issue: IssueData
    activity: ActivityData
    alert: WorkflowData


def _get_sentry_app_installation(
    action: Action, organization: Organization
) -> RpcSentryAppInstallation | None:
    target_identifier = require_config(action, "target_identifier")

    if action.type == Action.Type.SENTRY_APP:
        installations = app_service.get_many(
            filter=dict(
                app_ids=[int(target_identifier)],
                organization_id=organization.id,
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
            )
        )

    if not installations or len(installations) != 1:
        raise ValueError(f"Expected 1 sentry app installation, got {len(installations)}")
    return installations[0]


def _build_issue_data(group: Group) -> IssueData:
    serialized_group = serialize(group)  # BaseGroupSerializerResponse
    return IssueData(
        url=group.get_absolute_api_url(),
        webUrl=group.get_absolute_url(),
        **serialized_group,
    )


def _build_activity_data(activity: Activity) -> ActivityData:
    action_type = ACTIVITY_TYPE_TO_ACTION_TYPE.get(activity.type)
    if action_type is None:
        raise ValueError(f"Unrecognized activity type: {activity.type} for activity {activity.id}")

    match action_type:
        case (
            ActivityAlertActionType.SEER_RCA_COMPLETED,
            ActivityAlertActionType.SEER_SOLUTION_COMPLETED,
        ):
            summary = activity.data.get("summary", "")
            return ActivityData(type=action_type.value, details={"summary": summary})
        case ActivityAlertActionType.SEER_PR_CREATED:
            pull_requests_data = activity.data.get("pull_requests", [])
            pull_requests = [
                {
                    "repo_name": pull_request.get("repo_name"),
                    "url": pull_request.get("pull_request", {}).get("pr_url"),
                }
                for pull_request in pull_requests_data
            ]
            return ActivityData(type=action_type.value, details={"pull_requests": pull_requests})
        case _:
            return ActivityData(type=action_type.value, details={})


def _build_workflow_data(invocation: ActionInvocation, organization: Organization) -> WorkflowData:
    try:
        workflow = Workflow.objects.get(id=invocation.workflow_id, organization_id=organization.id)
    except Workflow.DoesNotExist:
        raise ValueError(f"Workflow not found: {invocation.workflow_id}")

    return WorkflowData(
        id=workflow.id,
        name=workflow.name,
        url=organization.absolute_url(
            f"organizations/{organization.slug}/monitors/alerts/{workflow.id}/"
        ),
    )


@activity_handler_registry.register(Action.Type.SENTRY_APP)
@activity_handler_registry.register(Action.Type.WEBHOOK)
class SentryAppActivityHandler(ActivityHandler):
    compatible_activity_types = NOTIFICATION_PLATFORM_COMPATIBLE_ACTIVITIES

    @classmethod
    def invoke_action(cls, invocation: ActionInvocation, activity: Activity) -> None:
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
            activity, group, project, organization = extract_models(activity.id)
            lifecycle.add_extras(
                {
                    "group_id": group.id,
                    "project_id": project.id,
                    "organization_id": organization.id,
                }
            )

            install = _get_sentry_app_installation(action, organization)
            data = ActivityAlertWebhookPayload(
                issue=_build_issue_data(group=group),
                activity=_build_activity_data(activity=activity),
                alert=_build_workflow_data(invocation=invocation, organization=organization),
            )
            request_data = AppPlatformEvent[ActivityAlertWebhookPayload](
                resource=SentryAppResourceType.ACTIVITY_ALERT,
                action=IssueAlertActionType.TRIGGERED,
                install=install,
                data=data,
            )
        send_and_save_webhook_request(install.sentry_app, request_data)
