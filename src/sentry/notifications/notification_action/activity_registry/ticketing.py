import logging
from typing import Any

from sentry.constants import ObjectStatus
from sentry.integrations.mixins.issues import IssueBasicIntegration
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.project_management.metrics import (
    ProjectManagementActionType,
    ProjectManagementEvent,
)
from sentry.integrations.services.integration.service import integration_service
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.notifications.notification_action.activity_registry.base import (
    NOTIFICATION_PLATFORM_COMPATIBLE_ACTIVITIES,
    require_integration_id,
)
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.notifications.notification_action.types import ActivityHandler
from sentry.notifications.utils.links import create_link_to_workflow
from sentry.silo.base import cell_silo_function
from sentry.types.activity import ActivityType
from sentry.utils.http import absolute_uri
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation
from sentry.workflow_engine.typings.notification_action import TicketFieldMappingKeys

logger = logging.getLogger(__name__)


@cell_silo_function
def _create_link(
    integration_id: int,
    installation: IssueBasicIntegration,
    organization_id: int,
    group: Group,
    group_title: str,
    description: str,
    response: dict[str, Any],
) -> None:
    external_issue_key = installation.make_external_key(response)

    external_issue = ExternalIssue.objects.create(
        organization_id=organization_id,
        integration_id=integration_id,
        key=external_issue_key,
        title=group_title,
        description=description,
        metadata=response.get("metadata"),
    )
    GroupLink.objects.create(
        group_id=group.id,
        project_id=group.project_id,
        linked_type=GroupLink.LinkedType.issue,
        linked_id=external_issue.id,
        relationship=GroupLink.Relationship.references,
        data={"provider": installation.model.get_provider().name},
    )
    issue_url = response.get("url") or installation.get_issue_url(external_issue.key)
    Activity.objects.create_group_activity(
        group=group,
        type=ActivityType.CREATE_ISSUE,
        data={
            "title": external_issue.title,
            "provider": installation.model.get_provider().name,
            "location": issue_url,
            "label": installation.get_issue_display_name(external_issue) or external_issue.key,
            "new": True,
        },
    )


def _has_linked_issue(group_id: int, project_id: int, integration_id: int) -> bool:
    return ExternalIssue.objects.filter(
        id__in=GroupLink.objects.filter(
            project_id=project_id,
            group_id=group_id,
            linked_type=GroupLink.LinkedType.issue,
        ).values_list("linked_id", flat=True),
        integration_id=integration_id,
    ).exists()


def _build_description(
    installation: IssueBasicIntegration,
    group: Group,
    workflow_id: int | None,
    organization_slug: str,
) -> str:
    description_parts = installation.get_group_link(group)
    if workflow_id is not None:
        workflow_url = create_link_to_workflow(organization_slug, str(workflow_id))
        description_parts.append(
            f"\nThis ticket was automatically created by Sentry via [Alert]({absolute_uri(workflow_url)})"
        )
    return "\n".join(description_parts)


@activity_handler_registry.register(Action.Type.GITHUB)
@activity_handler_registry.register(Action.Type.GITHUB_ENTERPRISE)
@activity_handler_registry.register(Action.Type.JIRA)
@activity_handler_registry.register(Action.Type.JIRA_SERVER)
@activity_handler_registry.register(Action.Type.AZURE_DEVOPS)
class TicketingActivityHandler(ActivityHandler):
    compatible_activity_types = NOTIFICATION_PLATFORM_COMPATIBLE_ACTIVITIES

    @classmethod
    def invoke_action(cls, invocation: ActionInvocation, activity: Activity) -> None:
        from sentry.notifications.platform.templates.activity.base import (
            extract_notification_models_by_activity,
        )

        action = invocation.action
        group, project, organization = extract_notification_models_by_activity(activity)

        integration_id = require_integration_id(action)
        provider = action.type

        integration = integration_service.get_integration(
            integration_id=integration_id,
            provider=provider,
            organization_id=organization.id,
            status=ObjectStatus.ACTIVE,
        )
        if not integration:
            logger.warning(
                "notification_action.activity.ticketing.integration_not_found",
                extra={
                    "action_id": action.id,
                    "integration_id": integration_id,
                    "provider": provider,
                },
            )
            return

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

        if _has_linked_issue(group.id, project.id, integration_id):
            logger.info(
                "notification_action.activity.ticketing.link_already_exists",
                extra={
                    "action_id": action.id,
                    "group_id": group.id,
                    "project_id": project.id,
                    "integration_id": integration_id,
                    "provider": provider,
                },
            )
            return

        data: dict[str, Any] = {
            "title": group.title,
            "description": _build_description(
                installation, group, invocation.workflow_id, organization.slug
            ),
        }

        additional_fields = action.data.get(TicketFieldMappingKeys.ADDITIONAL_FIELDS_KEY.value, {})
        data.update(additional_fields)

        dynamic_form_fields = action.data.get(TicketFieldMappingKeys.DYNAMIC_FORM_FIELDS_KEY.value)
        if dynamic_form_fields:
            data["dynamic_form_fields"] = dynamic_form_fields

        with ProjectManagementEvent(
            action_type=ProjectManagementActionType.CREATE_EXTERNAL_ISSUE,
            integration=integration,
        ).capture() as lifecycle:
            lifecycle.add_extra("provider", provider)
            lifecycle.add_extra("integration_id", integration_id)
            lifecycle.add_extra("action_id", action.id)

            response = installation.create_issue(data)

        if data.get("dynamic_form_fields"):
            del data["dynamic_form_fields"]

        _create_link(
            integration_id=integration.id,
            installation=installation,
            organization_id=organization.id,
            group=group,
            group_title=group.title,
            description=data["description"],
            response=response,
        )
