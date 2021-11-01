from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Mapping, Sequence

from sentry import features
from sentry.models import GroupAssignee
from sentry.tasks.integrations import sync_assignee_outbound

if TYPE_CHECKING:
    from sentry.models import Group, Integration, Organization


def where_should_sync(
    integration: Integration,
    key: str,
    organization_id: int | None = None,
) -> Sequence[Organization]:
    """
    Given an integration, get the list of organizations where the sync type in
    `key` is enabled. If an optional `organization_id` is passed, then only
    check the integration for that organization.
    """
    kwargs = dict()
    if organization_id:
        kwargs["id"] = organization_id

    return [
        organization
        for organization in integration.organizations.filter(**kwargs)
        if features.has("organizations:integrations-issue-sync", organization)
        and integration.get_installation(organization.id).should_sync(key)
    ]


def get_user_id(projects_by_user: Mapping[int, Sequence[int]], group: Group) -> int | None:
    user_ids = [
        user_id
        for user_id, project_ids in projects_by_user.items()
        for project_id in project_ids
        if group.project_id == project_id
    ]
    if not user_ids:
        return None
    return user_ids[0]


def sync_group_assignee_inbound(
    integration: Integration,
    email: str | None,
    external_issue_key: str,
    assign: bool = True,
) -> Sequence[Group]:
    """
    Given an integration, user email address and an external issue key,
    assign linked groups to matching users. Checks project membership.
    Returns a list of groups that were successfully assigned.
    """
    from sentry.models import Group, Project, User

    logger = logging.getLogger(f"sentry.integrations.{integration.provider}")

    orgs_with_sync_enabled = where_should_sync(integration, "inbound_assignee")
    affected_groups = Group.objects.get_groups_by_external_issue(
        integration,
        orgs_with_sync_enabled,
        external_issue_key,
    )
    if not affected_groups:
        return []

    if not assign:
        for group in affected_groups:
            GroupAssignee.objects.deassign(group)
        return affected_groups

    users = User.objects.get_for_email(email)
    users_by_id = {user.id: user for user in users}
    projects_by_user = Project.objects.get_by_users(users)

    groups_assigned = []
    for group in affected_groups:
        user_id = get_user_id(projects_by_user, group)
        user = users_by_id.get(user_id)
        if user:
            GroupAssignee.objects.assign(group, user)
            groups_assigned.append(group)
        else:
            logger.info(
                "assignee-not-found-inbound",
                extra={
                    "integration_id": integration.id,
                    "email": email,
                    "issue_key": external_issue_key,
                },
            )
    return groups_assigned


def sync_group_assignee_outbound(group: Group, user_id: int | None, assign: bool = True) -> None:
    from sentry.models import GroupLink

    external_issue_ids = GroupLink.objects.filter(
        project_id=group.project_id, group_id=group.id, linked_type=GroupLink.LinkedType.issue
    ).values_list("linked_id", flat=True)

    for external_issue_id in external_issue_ids:
        sync_assignee_outbound.apply_async(
            kwargs={"external_issue_id": external_issue_id, "user_id": user_id, "assign": assign}
        )
