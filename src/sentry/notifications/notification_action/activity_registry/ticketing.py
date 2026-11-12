import logging
from typing import Any

from sentry.integrations.mixins.issues import IssueBasicIntegration
from sentry.integrations.project_management.ticket_creation import create_ticket
from sentry.integrations.services.integration.service import integration_service
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.notifications.notification_action.activity_registry.base import require_integration_id
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.notifications.notification_action.types import (
    EXCEPTION_IGNORE_LIST,
    ActivityHandler,
    BaseIssueAlertHandler,
)
from sentry.notifications.types import NotificationActionContext
from sentry.notifications.utils.links import create_link_to_workflow
from sentry.types.activity import STATUS_CHANGE_ACTIVITY_TYPES, ActivityType
from sentry.utils.http import absolute_uri
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation
from sentry.workflow_engine.typings.notification_action import TicketFieldMappingKeys

logger = logging.getLogger(__name__)

TICKETING_ACTIVITY_DESCRIPTIONS: dict[ActivityType, str] = {
    ActivityType.SEER_RCA_COMPLETED: "Root Cause",
    ActivityType.SEER_SOLUTION_COMPLETED: "Plan",
    ActivityType.SEER_CODING_COMPLETED: "Code Changes",
    ActivityType.SEER_PR_READY_FOR_REVIEW: "Pull Request",
}

TICKETING_COMPATIBLE_ACTIVITY_TYPES = [
    *TICKETING_ACTIVITY_DESCRIPTIONS,
    *STATUS_CHANGE_ACTIVITY_TYPES,
]


def _build_description(
    installation: IssueBasicIntegration,
    group: Group,
    action_context: NotificationActionContext,
) -> str:
    description_parts = installation.get_group_link(group)
    if action_context.origin.workflow_id is not None:
        workflow_url = create_link_to_workflow(
            action_context.project.organization.slug,
            str(action_context.origin.workflow_id),
        )
        workflow_link = installation.format_link(
            action_context.origin.label, absolute_uri(workflow_url)
        )
        description_parts.append(
            f"\nThis ticket was automatically created by Sentry via {workflow_link}"
        )
    return "\n".join(description_parts)


@activity_handler_registry.register(Action.Type.GITHUB)
@activity_handler_registry.register(Action.Type.GITHUB_ENTERPRISE)
@activity_handler_registry.register(Action.Type.JIRA)
@activity_handler_registry.register(Action.Type.JIRA_SERVER)
@activity_handler_registry.register(Action.Type.AZURE_DEVOPS)
class TicketingActivityHandler(ActivityHandler):
    compatible_activity_types = TICKETING_COMPATIBLE_ACTIVITY_TYPES

    @classmethod
    def invoke_action(cls, invocation: ActionInvocation, activity: Activity) -> None:
        from sentry.notifications.platform.templates.activity.base import (
            extract_notification_models_by_activity,
        )

        action = invocation.action
        group, _, organization = extract_notification_models_by_activity(activity)
        action_context = BaseIssueAlertHandler.create_action_context(
            action=action,
            detector=invocation.detector,
            event_data=invocation.event_data,
            workflow_id=invocation.workflow_id,
        )

        integration_id = require_integration_id(action)
        provider = action.type

        ctx = integration_service.organization_context(
            organization_id=organization.id,
            integration_id=integration_id,
            provider=provider,
        ).active()
        if ctx is None:
            logger.warning(
                "notification_action.activity.ticketing.integration_not_found",
                extra={
                    "action_id": action.id,
                    "integration_id": integration_id,
                    "provider": provider,
                },
            )
            return
        integration, _ = ctx

        installation = integration.get_installation(organization.id)
        if not isinstance(installation, IssueBasicIntegration):
            logger.error(
                "notification_action.activity.ticketing.invalid_installation",
                extra={
                    "action_id": action.id,
                    "integration_id": integration_id,
                    "provider": provider,
                },
            )
            return

        activity_description = TICKETING_ACTIVITY_DESCRIPTIONS.get(ActivityType(activity.type))
        title = f"[{activity_description}] {group.title}" if activity_description else group.title

        additional_fields = action.data.get(TicketFieldMappingKeys.ADDITIONAL_FIELDS_KEY.value, {})
        data: dict[str, Any] = {
            **additional_fields,
            "title": title,
            "description": _build_description(installation, group, action_context),
        }

        try:
            create_ticket(
                integration=integration,
                installation=installation,
                group=group,
                data=data,
                external_issue_title=title,
                external_issue_description=data["description"],
                metric_extras={"action_id": action.id, "activity_id": activity.id},
            )
        except EXCEPTION_IGNORE_LIST:
            return
