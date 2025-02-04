from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import TYPE_CHECKING

from django.db.models.query import QuerySet

from sentry import features
from sentry.integrations.models.integration import Integration
from sentry.integrations.project_management.metrics import (
    ProjectManagementActionType,
    ProjectManagementEvent,
    ProjectManagementHaltReason,
)
from sentry.integrations.services.assignment_source import AssignmentSource
from sentry.integrations.services.integration import integration_service
from sentry.integrations.tasks.sync_assignee_outbound import sync_assignee_outbound
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.silo.base import region_silo_function
from sentry.users.services.user.service import user_service

if TYPE_CHECKING:
    from sentry.integrations.services.integration import RpcIntegration


@region_silo_function
def where_should_sync(
    integration: RpcIntegration | Integration,
    key: str,
    organization_id: int | None = None,
) -> Sequence[Organization]:
    """
    Given an integration, get the list of organizations where the sync type in
    `key` is enabled. If an optional `organization_id` is passed, then only
    check the integration for that organization.
    """
    kwargs = dict()
    if organization_id is not None:
        kwargs["id"] = organization_id
        ois = integration_service.get_organization_integrations(
            integration_id=integration.id, organization_id=organization_id
        )
    else:
        ois = integration_service.get_organization_integrations(integration_id=integration.id)

    organizations = Organization.objects.filter(id__in=[oi.organization_id for oi in ois])

    return [
        organization
        for organization in organizations.filter(**kwargs)
        if features.has("organizations:integrations-issue-sync", organization)
        and integration.get_installation(organization_id=organization.id).should_sync(key)
    ]


def get_user_id(projects_by_user: dict[int, set[int]], group: Group) -> int | None:
    user_ids = [
        user_id
        for user_id, project_ids in projects_by_user.items()
        for project_id in project_ids
        if group.project_id == project_id
    ]
    if not user_ids:
        return None
    return user_ids[0]


@region_silo_function
def sync_group_assignee_inbound(
    integration: RpcIntegration | Integration,
    email: str | None,
    external_issue_key: str | None,
    assign: bool = True,
) -> QuerySet[Group] | list[Group]:
    """
    Given an integration, user email address and an external issue key,
    assign linked groups to matching users. Checks project membership.
    Returns a list of groups that were successfully assigned.
    """

    logger = logging.getLogger(f"sentry.integrations.{integration.provider}")

    with ProjectManagementEvent(
        action_type=ProjectManagementActionType.INBOUND_ASSIGNMENT_SYNC, integration=integration
    ).capture() as lifecycle:
        orgs_with_sync_enabled = where_should_sync(integration, "inbound_assignee")
        affected_groups = Group.objects.get_groups_by_external_issue(
            integration,
            orgs_with_sync_enabled,
            external_issue_key,
        )
        log_context = {
            "integration_id": integration.id,
            "email": email,
            "issue_key": external_issue_key,
        }
        if not affected_groups:
            logger.info("no-affected-groups", extra=log_context)
            return []

        if not assign:
            for group in affected_groups:
                # XXX: Pass an acting user and make the acting_user mandatory
                GroupAssignee.objects.deassign(
                    group,
                    assignment_source=AssignmentSource.from_integration(integration),
                )

            return affected_groups

        users = user_service.get_many_by_email(emails=[email], is_verified=True)
        users_by_id = {user.id: user for user in users}
        projects_by_user = Project.objects.get_by_users(users)

        groups_assigned = []
        for group in affected_groups:
            user_id = get_user_id(projects_by_user, group)
            user = users_by_id.get(user_id)
            if user:
                GroupAssignee.objects.assign(
                    group,
                    user,
                    assignment_source=AssignmentSource.from_integration(integration),
                )
                groups_assigned.append(group)
            else:
                lifecycle.record_halt(
                    ProjectManagementHaltReason.SYNC_INBOUND_ASSIGNEE_NOT_FOUND, extra=log_context
                )
                logger.info("inbound-assignee-not-found", extra=log_context)
        return groups_assigned


def sync_group_assignee_outbound(
    group: Group,
    user_id: int | None,
    assign: bool = True,
    assignment_source: AssignmentSource | None = None,
) -> None:
    from sentry.models.grouplink import GroupLink

    external_issue_ids = GroupLink.objects.filter(
        project_id=group.project_id, group_id=group.id, linked_type=GroupLink.LinkedType.issue
    ).values_list("linked_id", flat=True)

    for external_issue_id in external_issue_ids:
        sync_assignee_outbound.apply_async(
            kwargs={
                "external_issue_id": external_issue_id,
                "user_id": user_id,
                "assign": assign,
                "assignment_source_dict": (
                    assignment_source.to_dict() if assignment_source else None
                ),
            }
        )
