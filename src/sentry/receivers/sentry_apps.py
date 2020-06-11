from __future__ import absolute_import

from sentry.models import GroupAssignee, SentryAppInstallation
from sentry.signals import issue_ignored, issue_assigned, issue_resolved
from sentry.tasks.sentry_apps import workflow_notification


@issue_assigned.connect(weak=False)
def send_issue_assigned_webhook(project, group, user, **kwargs):
    assignee = GroupAssignee.objects.get(group_id=group.id).assigned_actor()

    actor = assignee.resolve()

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


def send_workflow_webhooks(organization, issue, user, event, data=None):
    data = data or {}

    for install in installations_to_notify(organization, event):
        workflow_notification.delay(
            installation_id=install.id,
            issue_id=issue.id,
            type=event.split(".")[-1],
            user_id=(user.id if user else None),
            data=data,
        )


def installations_to_notify(organization, event):
    installations = SentryAppInstallation.get_installed_for_org(organization.id).select_related(
        "sentry_app"
    )

    return [i for i in installations if event in i.sentry_app.events]
