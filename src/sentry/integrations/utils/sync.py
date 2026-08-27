from __future__ import annotations

import logging
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from django.db import router, transaction
from django.db.models.query import QuerySet

from sentry import features
from sentry.integrations.mixins.issues import where_should_sync
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.integrations.project_management.metrics import (
    ProjectManagementActionType,
    ProjectManagementEvent,
    ProjectManagementHaltReason,
)
from sentry.integrations.services.assignment_source import AssignmentSource
from sentry.integrations.tasks.sync_assignee_outbound import sync_assignee_outbound
from sentry.integrations.types import EXTERNAL_PROVIDERS_REVERSE, ExternalProviderEnum
from sentry.integrations.utils.assignee_sync import (
    lock_and_get_stale_organization_ids,
    parse_provider_event_time,
    record_provider_assignee_updated_at,
)
from sentry.issues.action_log import SYSTEM_ACTOR, action_context_scope
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.silo.base import cell_silo_function
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.integrations.services.integration import RpcIntegration


class AssigneeInboundSyncMethod(StrEnum):
    EMAIL = "email"
    EXTERNAL_ACTOR = "external_actor"


def should_sync_assignee_inbound(
    organization: Organization | RpcOrganization, provider: str
) -> bool:
    if provider == "github":
        return True
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


@contextmanager
def _ordered_assignment(
    integration: RpcIntegration | Integration,
    external_issue_key: str | None,
    groups: list[Group],
    event_updated_at: datetime | None,
) -> Iterator[list[Group]]:
    """
    Yield the groups this event still wins, with their issue rows locked, then watermark it.

    The body must be cell-local: a hybrid cloud RPC inside a transaction is a banned
    pattern, so cross-silo lookups have to be resolved before entering. The watermark is
    advanced only after the body returns, so a body that raises leaves both the assignment
    and the watermark untouched and the delivery retryable.

    Without a provider timestamp the guard is inert and no transaction is opened.
    """
    if event_updated_at is None:
        yield groups
        return

    with transaction.atomic(router.db_for_write(ExternalIssue)):
        fresh_groups = _drop_stale_groups(integration, external_issue_key, groups, event_updated_at)

        yield fresh_groups

        # Watermark every fresh group, even ones with no resolvable assignee — the event
        # has been processed for them and an older event must not undo that.
        record_provider_assignee_updated_at(
            integration,
            external_issue_key,
            {group.project.organization_id for group in fresh_groups},
            event_updated_at,
        )


def _drop_stale_groups(
    integration: RpcIntegration | Integration,
    external_issue_key: str | None,
    groups: list[Group],
    event_updated_at: datetime | None,
) -> list[Group]:
    """
    Lock this issue's rows and drop the groups a newer assignment change already covers.

    Webhook delivery is not ordered, and payloads carry the full assignee snapshot, so
    applying a late delivery would quietly restore a stale assignee.
    """
    stale_organization_ids = lock_and_get_stale_organization_ids(
        integration,
        external_issue_key,
        {group.project.organization_id for group in groups},
        event_updated_at,
    )
    if not stale_organization_ids:
        return groups

    metrics.incr(
        "integrations.sync_assignee_inbound.stale_event",
        tags={"provider": integration.provider},
    )
    logging.getLogger(f"sentry.integrations.{integration.provider}").info(
        "sync_group_assignee_inbound.stale_event",
        extra={
            "integration_id": integration.id,
            "issue_key": external_issue_key,
            "event_updated_at": event_updated_at,
            "stale_organization_ids": sorted(stale_organization_ids),
        },
    )
    return [
        group for group in groups if group.project.organization_id not in stale_organization_ids
    ]


def _handle_deassign(
    groups: Iterable[Group], integration: RpcIntegration | Integration
) -> list[Group]:
    groups_deassigned: list[Group] = []
    for group in groups:
        if not should_sync_assignee_inbound(group.organization, integration.provider):
            continue

        with action_context_scope(source=integration.provider, actor=SYSTEM_ACTOR):
            GroupAssignee.objects.deassign(
                group,
                assignment_source=AssignmentSource.from_integration(integration),
            )
        groups_deassigned.append(group)
    return groups_deassigned


def _handle_assign(
    affected_groups: Iterable[Group],
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
            with action_context_scope(source=integration.provider, actor=SYSTEM_ACTOR):
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


@cell_silo_function
def sync_group_assignee_inbound_by_external_actor(
    integration: RpcIntegration | Integration,
    external_user_name: str,
    external_issue_key: str | None,
    assign: bool = True,
    external_user_id: str | int | None = None,
    provider_event_updated_at: str | None = None,
) -> QuerySet[Group] | list[Group]:
    logger = logging.getLogger(f"sentry.integrations.{integration.provider}")
    event_updated_at = parse_provider_event_time(provider_event_updated_at)

    with ProjectManagementEvent(
        action_type=ProjectManagementActionType.INBOUND_ASSIGNMENT_SYNC, integration=integration
    ).capture() as lifecycle:
        affected_groups = list(_get_affected_groups(integration, external_issue_key))
        external_user_id_str = str(external_user_id) if external_user_id is not None else None
        log_context = {
            "integration_id": integration.id,
            "external_user_name": external_user_name,
            "external_user_id": external_user_id_str,
            "issue_key": external_issue_key,
            "method": AssigneeInboundSyncMethod.EXTERNAL_ACTOR.value,
            "assign": assign,
            "affected_group_ids": [group.id for group in affected_groups],
        }
        lifecycle.add_extras(log_context)

        if not affected_groups:
            logger.info("no-affected-groups", extra=log_context)
            return []

        if not assign:
            with _ordered_assignment(
                integration, external_issue_key, affected_groups, event_updated_at
            ) as fresh_groups:
                groups_deassigned = _handle_deassign(fresh_groups, integration)
            log_context["unassigned_group_ids"] = [group.id for group in groups_deassigned]
            lifecycle.add_extras(log_context)
            return groups_deassigned

        base_external_actors = ExternalActor.objects.filter(
            provider=EXTERNAL_PROVIDERS_REVERSE[ExternalProviderEnum(integration.provider)].value,
            integration_id=integration.id,
            user_id__isnull=False,
        )

        match_method = "external_name"
        external_actors = base_external_actors.filter(external_name__iexact=external_user_name)

        external_actor_user_ids = list(external_actors.values_list("user_id", flat=True))
        user_ids = [
            external_actor_user_id
            for external_actor_user_id in external_actor_user_ids
            if external_actor_user_id is not None
        ]

        log_context["match_method"] = match_method
        log_context["external_actor_count"] = len(user_ids)
        log_context["matched_user_ids"] = user_ids
        log_context["user_ids"] = user_ids
        logger.info("sync_group_assignee_inbound_by_external_actor.user_ids", extra=log_context)
        lifecycle.add_extras(log_context)

        # Resolved before the lock is taken: this is a cross-silo call.
        users = user_service.get_many_by_id(ids=user_ids)

        with _ordered_assignment(
            integration, external_issue_key, affected_groups, event_updated_at
        ) as fresh_groups:
            groups_assigned = _handle_assign(fresh_groups, integration, users)

        log_context["assigned_group_ids"] = [group.id for group in groups_assigned]
        lifecycle.add_extras(log_context)

        if len(groups_assigned) != len(fresh_groups):
            log_context["groups_assigned_count"] = len(groups_assigned)
            log_context["affected_groups_count"] = len(fresh_groups)
            lifecycle.record_halt(
                ProjectManagementHaltReason.SYNC_INBOUND_ASSIGNEE_NOT_FOUND, extra=log_context
            )

        return groups_assigned


@cell_silo_function
def sync_group_assignee_inbound(
    integration: RpcIntegration | Integration,
    email: str | None,
    external_issue_key: str | None,
    assign: bool = True,
    provider_event_updated_at: str | None = None,
) -> QuerySet[Group] | list[Group]:
    """
    Given an integration, user email address and an external issue key,
    assign linked groups to matching users. Checks project membership.
    Returns a list of groups that were successfully assigned.
    """

    logger = logging.getLogger(f"sentry.integrations.{integration.provider}")
    event_updated_at = parse_provider_event_time(provider_event_updated_at)

    with ProjectManagementEvent(
        action_type=ProjectManagementActionType.INBOUND_ASSIGNMENT_SYNC, integration=integration
    ).capture() as lifecycle:
        affected_groups = list(_get_affected_groups(integration, external_issue_key))
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
            with _ordered_assignment(
                integration, external_issue_key, affected_groups, event_updated_at
            ) as fresh_groups:
                groups_deassigned = _handle_deassign(fresh_groups, integration)
            return groups_deassigned

        # Resolved before the lock is taken: this is a cross-silo call.
        users = user_service.get_many_by_email(emails=[email], is_verified=True)

        with _ordered_assignment(
            integration, external_issue_key, affected_groups, event_updated_at
        ) as fresh_groups:
            groups_assigned = _handle_assign(fresh_groups, integration, users)

        if len(groups_assigned) != len(fresh_groups):
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
