from __future__ import annotations

import logging
from enum import StrEnum
from typing import TYPE_CHECKING

from django.db.models.query import QuerySet

from sentry import features
from sentry.integrations.mixins.issues import where_should_sync
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.models.integration import Integration
from sentry.integrations.project_management.metrics import (
    ProjectManagementActionType,
    ProjectManagementEvent,
    ProjectManagementHaltReason,
)
from sentry.integrations.services.assignment_source import AssignmentSource
from sentry.integrations.tasks.sync_assignee_outbound import sync_assignee_outbound
from sentry.integrations.types import EXTERNAL_PROVIDERS_REVERSE, ExternalProviderEnum
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.silo.base import region_silo_function
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service

if TYPE_CHECKING:
    from sentry.integrations.services.integration import RpcIntegration


class AssigneeInboundSyncMethod(StrEnum):
    EMAIL = "email"
    EXTERNAL_ACTOR = "external_actor"


def should_sync_assignee_inbound(
    organization: Organization | RpcOrganization, provider: str
) -> bool:
    if provider == "github":
        return features.has("organizations:integrations-github-project-management", organization)
    elif provider == "github_enterprise":
        return features.has(
            "organizations:integrations-github_enterprise-project-management", organization
        )
    elif provider == "gitlab":
        return features.has("organizations:integrations-gitlab-project-management", organization)
    return True


def _get_user_id(projects_by_user: dict[int, set[int]], group: Group) -> int | None:
    user_ids = [
        user_id
        for user_id, project_ids in projects_by_user.items()
        for project_id in project_ids
        if group.project_id == project_id
    ]
    if not user_ids:
        return None
    return user_ids[0]


def _get_affected_groups(
    integration: RpcIntegration | Integration, external_issue_key: str | None
) -> QuerySet[Group]:
    orgs_with_sync_enabled = where_should_sync(integration, "inbound_assignee")
    return Group.objects.get_groups_by_external_issue(
        integration,
        orgs_with_sync_enabled,
        external_issue_key,
    )


def _handle_deassign(
    groups: QuerySet[Group], integration: RpcIntegration | Integration
) -> QuerySet[Group]:
    for group in groups:
        if not should_sync_assignee_inbound(group.organization, integration.provider):
            continue

        GroupAssignee.objects.deassign(
            group,
            assignment_source=AssignmentSource.from_integration(integration),
        )
    return groups


def _handle_assign(
    affected_groups: QuerySet[Group],
    integration: RpcIntegration | Integration,
    users: list[RpcUser],
) -> list[Group]:

    groups_assigned: list[Group] = []

    users_by_id = {user.id: user for user in users}
    projects_by_user = Project.objects.get_by_users(users)

    logger = logging.getLogger(f"sentry.integrations.{integration.provider}")

    for group in affected_groups:
        if not should_sync_assignee_inbound(group.organization, integration.provider):
            continue

        user_id = _get_user_id(projects_by_user, group)
        user = users_by_id.get(user_id) if user_id is not None else None
        if user:
            logger.info(
                "sync_group_assignee_inbound._handle_assign.assigning.group",
                extra={
                    "group_id": group.id,
                    "user_id": user.id,
                },
            )
            GroupAssignee.objects.assign(
                group,
                user,
                assignment_source=AssignmentSource.from_integration(integration),
            )
            groups_assigned.append(group)
        else:
            logger.info(
                "sync_group_assignee_inbound._handle_assign.user_not_found",
                extra={
                    "group_id": group.id,
                    "user_id": user_id,
                },
            )

    return groups_assigned


@region_silo_function
def sync_group_assignee_inbound_by_external_actor(
    integration: RpcIntegration | Integration,
    external_user_name: str,
    external_issue_key: str | None,
    assign: bool = True,
) -> QuerySet[Group] | list[Group]:

    logger = logging.getLogger(f"sentry.integrations.{integration.provider}")

    with ProjectManagementEvent(
        action_type=ProjectManagementActionType.INBOUND_ASSIGNMENT_SYNC, integration=integration
    ).capture() as lifecycle:
        affected_groups = _get_affected_groups(integration, external_issue_key)
        log_context = {
            "integration_id": integration.id,
            "external_user_name": external_user_name,
            "issue_key": external_issue_key,
            "method": AssigneeInboundSyncMethod.EXTERNAL_ACTOR.value,
            "assign": assign,
        }

        if not affected_groups:
            logger.info("no-affected-groups", extra=log_context)
            return []

        if not assign:
            return _handle_deassign(affected_groups, integration)

        external_actors = ExternalActor.objects.filter(
            provider=EXTERNAL_PROVIDERS_REVERSE[ExternalProviderEnum(integration.provider)].value,
            external_name__iexact=external_user_name,
            integration_id=integration.id,
            user_id__isnull=False,
        ).values_list("user_id", flat=True)

        user_ids = [
            external_actor for external_actor in external_actors if external_actor is not None
        ]

        log_context["user_ids"] = user_ids
        logger.info("sync_group_assignee_inbound_by_external_actor.user_ids", extra=log_context)

        users = user_service.get_many_by_id(ids=user_ids)

        groups_assigned = _handle_assign(affected_groups, integration, users)

        if len(groups_assigned) != len(affected_groups):
            log_context["groups_assigned_count"] = len(groups_assigned)
            log_context["affected_groups_count"] = len(affected_groups)
            lifecycle.record_halt(
                ProjectManagementHaltReason.SYNC_INBOUND_ASSIGNEE_NOT_FOUND, extra=log_context
            )

        return groups_assigned


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
        affected_groups = _get_affected_groups(integration, external_issue_key)
        log_context = {
            "integration_id": integration.id,
            "email": email,
            "issue_key": external_issue_key,
            "method": AssigneeInboundSyncMethod.EMAIL.value,
            "assign": assign,
        }
        if not affected_groups:
            logger.info("no-affected-groups", extra=log_context)
            return []

        if not assign:
            return _handle_deassign(affected_groups, integration)

        users = user_service.get_many_by_email(emails=[email], is_verified=True)

        groups_assigned = _handle_assign(affected_groups, integration, users)

        if len(groups_assigned) != len(affected_groups):
            lifecycle.record_halt(
                ProjectManagementHaltReason.SYNC_INBOUND_ASSIGNEE_NOT_FOUND, extra=log_context
            )

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
