from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry import features
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.models.user import User
from sentry.services.hybrid_cloud import coerce_id_from
from sentry.services.hybrid_cloud.app import RpcSentryAppInstallation, app_service
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.signals import (
    comment_created,
    comment_deleted,
    comment_updated,
    issue_assigned,
    issue_escalating,
    issue_ignored,
    issue_resolved,
    issue_unresolved,
)
from sentry.tasks.sentry_apps import build_comment_webhook, workflow_notification


@issue_assigned.connect(weak=False)
def send_issue_assigned_webhook(project, group, user, **kwargs):
    assignee = GroupAssignee.objects.get(group_id=group.id).assigned_actor()

    actor: RpcUser | Team = assignee.resolve()

    data = {
        "assignee": {"type": str(assignee.actor_type).lower(), "name": actor.name, "id": actor.id}
    }

    org = project.organization

    if hasattr(actor, "email") and not org.flags.enhanced_privacy:
        data["assignee"]["email"] = actor.email

    send_workflow_webhooks(org, group, user, "issue.assigned", data=data)


@issue_resolved.connect(weak=False)
def send_issue_resolved_webhook(organization_id, project, group, user, resolution_type, **kwargs):
    send_workflow_webhooks(
        project.organization,
        group,
        user,
        "issue.resolved",
        data={"resolution_type": resolution_type},
    )


@issue_ignored.connect(weak=False)
def send_issue_ignored_webhook(project, user, group_list, **kwargs):
    for issue in group_list:
        send_workflow_webhooks(project.organization, issue, user, "issue.ignored")
        send_workflow_webhooks(project.organization, issue, user, "issue.archived")


@issue_unresolved.connect(weak=False)
def send_issue_unresolved_webhook(
    group: Group,
    project: Project,
    user: User | RpcUser | None = None,
    **kwargs,
) -> None:
    send_issue_unresolved_webhook_helper(group=group, project=project, user=user, **kwargs)


@issue_escalating.connect(weak=False)
def send_issue_escalating_webhook(
    group: Group,
    project: Project,
    **kwargs,
) -> None:
    # Escalating is a form of unresolved so we send the same webhook
    send_issue_unresolved_webhook_helper(group=group, project=project, **kwargs)


def send_issue_unresolved_webhook_helper(
    group: Group,
    project: Project,
    user: User | RpcUser | None = None,
    data: Mapping[str, Any] | None = None,
    **kwargs,
) -> None:
    organization = project.organization
    if features.has("organizations:webhooks-unresolved", organization):
        send_workflow_webhooks(
            organization=organization,
            issue=group,
            user=user,
            event="issue.unresolved",
            data=data,
        )


@comment_created.connect(weak=False)
def send_comment_created_webhook(project, user, group, data, **kwargs):
    send_comment_webhooks(project.organization, group, user, "comment.created", data=data)


@comment_updated.connect(weak=False)
def send_comment_updated_webhook(project, user, group, data, **kwargs):
    send_comment_webhooks(project.organization, group, user, "comment.updated", data=data)


@comment_deleted.connect(weak=False)
def send_comment_deleted_webhook(project, user, group, data, **kwargs):
    send_comment_webhooks(project.organization, group, user, "comment.deleted", data=data)


def send_comment_webhooks(organization, issue, user, event, data=None):
    data = data or {}

    for install in installations_to_notify(organization, event):
        build_comment_webhook.delay(
            installation_id=install.id,
            issue_id=issue.id,
            type=event,
            user_id=coerce_id_from(user),
            data=data,
        )


def send_workflow_webhooks(
    organization: Organization,
    issue: Group,
    user: User | RpcUser | None,
    event: str,
    data: Mapping[str, Any] | None = None,
) -> None:
    data = data or {}

    for install in installations_to_notify(organization, event):
        workflow_notification.delay(
            installation_id=install.id,
            issue_id=issue.id,
            type=event.split(".")[-1],
            user_id=coerce_id_from(user),
            data=data,
        )


def installations_to_notify(organization, event) -> list[RpcSentryAppInstallation]:
    installations = app_service.get_installed_for_organization(organization_id=organization.id)
    return [i for i in installations if event in i.sentry_app.events]
