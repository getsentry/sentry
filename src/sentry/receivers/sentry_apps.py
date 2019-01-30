from __future__ import absolute_import

from django.db.models.signals import post_save
from django.dispatch import receiver

from sentry.models import Group, Organization
from sentry.signals import (
    issue_ignored,
    issue_resolved,
    issue_resolved_in_release,
    resolved_with_commit,
)
from sentry.tasks.sentry_apps import (
    process_resource_change_bound,
    workflow_notification,
)


@receiver(post_save, sender=Group, weak=False)
def issue_saved(sender, instance, created, **kwargs):
    issue = instance

    # We only send webhooks for creation right now.
    if not created:
        return

    process_resource_change_bound.delay(
        action='created',
        sender=sender.__name__,
        instance_id=issue.id,
    )


@issue_resolved_in_release.connect(weak=False)
def issue_resolved_in_release(project, group, user, resolution_type, **kwargs):
    send_workflow_webhooks(
        project.organization,
        group,
        user,
        'issue.resolved',
        {'resolution_type': 'resolved_in_release'},
    )


@issue_resolved.connect(weak=False)
def issue_resolved(project, group, user, **kwargs):
    send_workflow_webhooks(
        project.organization,
        group,
        user,
        'issue.resolved',
        {'resolution_type': 'resolved'},
    )


@issue_ignored.connect(weak=False)
def issue_ignored(project, user, group_list, **kwargs):
    for issue in group_list:
        send_workflow_webhooks(
            project.organization,
            issue,
            user,
            'issue.ignored',
        )


@resolved_with_commit.connect(weak=False)
def resolved_with_commit(organization_id, group, user, **kwargs):
    organization = Organization.objects.get(id=organization_id)
    send_workflow_webhooks(
        organization,
        group,
        user,
        'issue.resolved',
        {'resolution_type': 'resolved_in_commit'},
    )


def send_workflow_webhooks(organization, issue, user, event, data=None):
    data = data or {}

    for install in installations_to_notify(organization, event):
        workflow_notification.delay(
            installation_id=install.id,
            issue_id=issue.id,
            type=event.split('.')[-1],
            user_id=(user.id if user else None),
            data=data,
        )


def installations_to_notify(organization, event):
    installations = organization  \
        .sentry_app_installations \
        .select_related('sentry_app')

    return filter(lambda i: event in i.sentry_app.events, installations)
