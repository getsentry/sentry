from __future__ import annotations

from typing import Any, List, Mapping

from sentry import features
from sentry.api.serializers import serialize
from sentry.api.serializers.models.user import UserSerializer
from sentry.models import Group, GroupAssignee, Organization, SentryFunction, Team, User
from sentry.services.hybrid_cloud.app import ApiSentryAppInstallation, app_service
from sentry.services.hybrid_cloud.user import APIUser, user_service
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

    actor: APIUser | Team = assignee.resolve()

    data = {
        "assignee": {"type": assignee.type.__name__.lower(), "name": actor.name, "id": actor.id}
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
            user_id=(user.id if user else None),
            data=data,
        )
    if features.has("organizations:sentry-functions", organization, actor=user):
        if user:
            data["user"] = serialize(user, serializer=UserSerializer())
        for fn in SentryFunction.objects.get_sentry_functions(organization, "comment"):
            send_sentry_function_webhook.delay(fn.external_id, event, issue.id, data)


def send_workflow_webhooks(
    organization: Organization,
    issue: Group,
    user: User | APIUser,
    event: str,
    data: Mapping[str, Any] | None = None,
) -> None:
    data = data or {}

    for install in installations_to_notify(organization, event):
        workflow_notification.delay(
            installation_id=install.id,
            issue_id=issue.id,
            type=event.split(".")[-1],
            user_id=(user.id if user else None),
            data=data,
        )
    if features.has("organizations:sentry-functions", organization, actor=user):
        if user:
            data["user"] = user_service.serialize_users([user.id])[0]
        for fn in SentryFunction.objects.get_sentry_functions(organization, "issue"):
            send_sentry_function_webhook.delay(fn.external_id, event, issue.id, data)


def installations_to_notify(organization, event) -> List[ApiSentryAppInstallation]:
    installations = app_service.get_installed_for_organization(organization_id=organization.id)
    return [i for i in installations if event in i.sentry_app.events]
