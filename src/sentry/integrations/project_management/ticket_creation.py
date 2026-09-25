import logging
from collections.abc import Mapping
from typing import Any

from sentry.exceptions import InvalidIdentity
from sentry.integrations.mixins.issues import IssueBasicIntegration
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.project_management.metrics import (
    ProjectManagementActionType,
    ProjectManagementEvent,
)
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.issues.action_log.publish import publish_action_from_context
from sentry.issues.action_log.types import CreateExternalIssueAction
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.shared_integrations.exceptions import (
    ApiUnauthorized,
    IntegrationConfigurationError,
    IntegrationFormError,
    IntegrationProviderError,
    IntegrationResourceNotFoundError,
)
from sentry.silo.base import cell_silo_function
from sentry.types.activity import ActivityType

logger = logging.getLogger(__name__)


def has_linked_issue(*, group: Group, integration_id: int) -> bool:
    return ExternalIssue.objects.filter(
        id__in=GroupLink.objects.filter(
            project_id=group.project_id,
            group_id=group.id,
            linked_type=GroupLink.LinkedType.issue,
        ).values_list("linked_id", flat=True),
        integration_id=integration_id,
    ).exists()


@cell_silo_function
def create_external_issue_link(
    *,
    integration: RpcIntegration,
    installation: IssueBasicIntegration,
    group: Group,
    title: str,
    description: str,
    response: Mapping[str, Any],
) -> ExternalIssue:
    external_issue = ExternalIssue.objects.create(
        organization_id=group.project.organization_id,
        integration_id=integration.id,
        key=installation.make_external_key(response),
        title=title,
        description=description,
        metadata=response.get("metadata"),
    )
    GroupLink.objects.create(
        group_id=group.id,
        project_id=group.project_id,
        linked_type=GroupLink.LinkedType.issue,
        linked_id=external_issue.id,
        relationship=GroupLink.Relationship.references,
        data={"provider": integration.provider},
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
    publish_action_from_context(
        CreateExternalIssueAction(
            provider=integration.provider,
            external_issue_key=external_issue.key,
        ),
        group_id=group.id,
        project=group.project,
    )
    return external_issue


def create_ticket(
    *,
    integration: RpcIntegration,
    installation: IssueBasicIntegration,
    group: Group,
    data: dict[str, Any],
    external_issue_title: str,
    external_issue_description: str,
    metric_extras: Mapping[str, object] | None = None,
) -> ExternalIssue | None:
    if has_linked_issue(group=group, integration_id=integration.id):
        logger.info(
            "integrations.project_management.ticket.link_already_exists",
            extra={
                "group_id": group.id,
                "project_id": group.project_id,
                "integration_id": integration.id,
                "provider": integration.provider,
                **(metric_extras or {}),
            },
        )
        return None

    with ProjectManagementEvent(
        action_type=ProjectManagementActionType.CREATE_EXTERNAL_ISSUE,
        integration=integration,
    ).capture() as lifecycle:
        lifecycle.add_extra("provider", integration.provider)
        lifecycle.add_extra("integration_id", integration.id)
        for key, value in (metric_extras or {}).items():
            lifecycle.add_extra(key, value)

        try:
            response = installation.create_issue(data)
        except (
            IntegrationConfigurationError,
            IntegrationFormError,
            InvalidIdentity,
            ApiUnauthorized,
            IntegrationResourceNotFoundError,
            IntegrationProviderError,
        ) as error:
            lifecycle.record_halt(error)
            raise

    return create_external_issue_link(
        integration=integration,
        installation=installation,
        group=group,
        title=external_issue_title,
        description=external_issue_description,
        response=response,
    )
