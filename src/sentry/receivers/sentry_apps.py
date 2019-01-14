from __future__ import absolute_import

from django.db.models.signals import post_save
from django.dispatch import receiver

from sentry.models import Group, Organization
from sentry.signals import (
    issue_resolved,
    issue_resolved_in_release,
    resolved_with_commit,
)
from sentry.tasks.sentry_apps import (
    process_resource_change,
    workflow_notification,
)


@receiver(post_save, sender=Group, weak=False)
def issue_saved(sender, instance, created, **kwargs):
    issue = instance

    # We only send webhooks for creation right now.
    if not created:
        return

    process_resource_change.delay(
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
        'resolved_in_release',
    )


@issue_resolved.connect(weak=False)
def issue_resolved(project, group, user, **kwargs):
    send_workflow_webhooks(
        project.organization,
        group,
        user,
        'issue.resolved',
        'resolved',
    )


@resolved_with_commit.connect(weak=False)
def resolved_with_commit(organization_id, group, user, **kwargs):
    organization = Organization.objects.get(id=organization_id)
    send_workflow_webhooks(
        organization,
        group,
        user,
        'issue.resolved',
        'resolved_in_commit',
    )


def send_workflow_webhooks(organization, issue, user, event, resolution_type):
    for install in installations_to_notify(organization, event):
        workflow_notification.delay(
            installation_id=install.id,
            issue_id=issue.id,
            type='resolved',
            user_id=(user.id if user else None),
            data={'resolution_type': resolution_type},
        )


def installations_to_notify(organization, event):
    installations = organization  \
        .sentry_app_installations \
        .select_related('sentry_app')

    return filter(lambda i: event in i.sentry_app.events, installations)
