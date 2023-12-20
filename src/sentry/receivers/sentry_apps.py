from __future__ import annotations

from typing import Any, List, Mapping

from sentry import features
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.organization import Organization
from sentry.models.sentryfunction import SentryFunction
from sentry.models.team import Team
from sentry.models.user import User
from sentry.services.hybrid_cloud import coerce_id_from
from sentry.services.hybrid_cloud.app import RpcSentryAppInstallation, app_service
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.signals import (
    comment_created,
    comment_deleted,
    comment_updated,
    issue_assigned,
    issue_ignored,
    issue_resolved,
)
from sentry.tasks.sentry_apps import build_comment_webhook, workflow_notification
from sentry.tasks.sentry_functions import send_sentry_function_webhook


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
        if features.has("organizations:escalating-issues", project.organization):
            send_workflow_webhooks(project.organization, issue, user, "issue.archived")


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
    if features.has("organizations:sentry-functions", organization, actor=user):
        if user:
            serialized = user_service.serialize_many(filter=dict(user_ids=[user.id]))
            if serialized:
                data["user"] = serialized[0]
        for fn in SentryFunction.objects.get_sentry_functions(organization, "comment"):
            send_sentry_function_webhook.delay(fn.external_id, event, issue.id, data)


def send_workflow_webhooks(
    organization: Organization,
    issue: Group,
    user: User | RpcUser,
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
    if features.has("organizations:sentry-functions", organization, actor=user):
        if user:
            data["user"] = user_service.serialize_many(filter={"user_ids": [user.id]})[0]
        for fn in SentryFunction.objects.get_sentry_functions(organization, "issue"):
            send_sentry_function_webhook.delay(fn.external_id, event, issue.id, data)


def installations_to_notify(organization, event) -> List[RpcSentryAppInstallation]:
    installations = app_service.get_installed_for_organization(organization_id=organization.id)
    return [i for i in installations if event in i.sentry_app.events]
