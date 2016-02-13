from __future__ import print_function, absolute_import

from django.db import IntegrityError, transaction
from django.utils import timezone

from sentry.models import (
    OnboardingTask, OnboardingTaskStatus, OrganizationOnboardingTask
)
from sentry.plugins import IssueTrackingPlugin, NotificationPlugin
from sentry.signals import (
    event_processed,
    project_created,
    first_event_pending,
    first_event_received,
    member_invited,
    member_joined,
    plugin_enabled,
    issue_tracker_used,
    user_context_received,
    release_received,
    sourcemap_received,
)

@project_created.connect(weak=False)
def record_new_project(project, user, **kwargs):
    try:
        with transaction.atomic():
            OrganizationOnboardingTask.objects.create(
                organization=project.organization,
                task=OnboardingTask.FIRST_PROJECT,
                user=user,
                status=OnboardingTaskStatus.COMPLETE,
                project=project,
                date_completed=timezone.now(),
            )
    except IntegrityError:
        try:
            with transaction.atomic():
                OrganizationOnboardingTask.objects.create(
                    organization=instance.organization,
                    task=OnboardingTask.SECOND_PLATFORM,
                    user=user,
                    status=OnboardingTaskStatus.PENDING,
                    project=instance,
                    date_completed=timezone.now(),
                )
        except IntegrityError:
            pass

@first_event_pending.connect(weak=False)
def record_raven_installed(instance, user, **kwargs):
    """
    Args:
        instance (sentry.models.Project)
        user (sentry.models.user)
    """
    oot, created = OrganizationOnboardingTask.objects.get_or_create(
        organization=instance.organization,
        task=OnboardingTask.FIRST_EVENT,
        status=OnboardingTaskStatus.PENDING,
        defaults={
            'user': user,
            'project': instance,
            'date_completed': timezone.now()
        }
    )

@first_event_received.connect(weak=False)
def record_first_event(instance, group, **kwargs):
    """
    Requires up to 2 database calls, but should only run with the first event in
    any project, so performance should not be a huge bottleneck.

    Args:
        instance (sentry.models.Project)
        group (sentry.models.Group)
    """
    # If complete, pass (creation fails due to organization, task unique constraint)
    # If pending, update.
    # If does not exist, create.
    rows_affected, created = OrganizationOnboardingTask.objects.create_or_update(
        organization=instance.organization,
        task=OnboardingTask.FIRST_EVENT,
        status=OnboardingTaskStatus.PENDING,
        values={
            'status': OnboardingTaskStatus.COMPLETE,
            'project': instance,
            'date_completed': instance.first_event,
            'data': { 'platform': group.platform },
        }
    )

    # If first_event task is complete
    if not rows_affected and not created:
        oot = OrganizationOnboardingTask.objects.filter(
            organization=instance.organization,
            task=OnboardingTask.FIRST_EVENT
        ).first()

        # Only counts if it's a new project and platform
        if oot.project != instance and oot.data['platform'] != group.platform:
            OrganizationOnboardingTask.objects.create_or_update(
                organization=instance.organization,
                task=OnboardingTask.SECOND_PLATFORM,
                status=OnboardingTaskStatus.PENDING,
                values={
                    'status': OnboardingTaskStatus.COMPLETE,
                    'project': instance,
                    'date_completed': instance.first_event,
                    'data': { 'platform': group.platform },
                }
            )

@member_invited.connect(weak=False)
def record_member_invited(member, user, **kwargs):
    try:
        with transaction.atomic():
            OrganizationOnboardingTask.objects.create(
                organization=member.organization,
                task=OnboardingTask.INVITE_MEMBER,
                user=user,
                status=OnboardingTaskStatus.PENDING,
                date_completed=timezone.now(),
                data={ 'invited_member_id': member.id }
            )
    except IntegrityError:
        pass

@member_joined.connect(weak=False)
def record_member_joined(member, **kwargs):
    try:
        OrganizationOnboardingTask.objects.filter(
            organization=member.organization,
            task=OnboardingTask.INVITE_MEMBER
        ).exclude(
            status=OnboardingTaskStatus.COMPLETE
        ).update(
            status=OnboardingTaskStatus.COMPLETE,
            date_completed=timezone.now(),
            data={'invited_member_id': member.id}
        )
    except IntegrityError:
        pass

@event_processed.connect(weak=False)
def record_release_received(project, group, event, **kwargs):
    if event.get_tag('sentry:release'):
        try:
            with transaction.atomic():
                OrganizationOnboardingTask.objects.create(
                    organization=project.organization,
                    task=OnboardingTask.RELEASE_TRACKING,
                    status=OnboardingTaskStatus.COMPLETE,
                    project=project,
                    date_completed=timezone.now()
                )
        except IntegrityError:
            pass

@event_processed.connect(weak=False)
def record_user_context_received(project, group, event, **kwargs):
    if event.data.get('sentry.interfaces.User'):
        try:
            with transaction.atomic():
                OrganizationOnboardingTask.objects.create(
                    organization=project.organization,
                    task=OnboardingTask.USER_CONTEXT,
                    status=OnboardingTaskStatus.COMPLETE,
                    project=project,
                    date_completed=timezone.now()
                )
        except IntegrityError:
            pass

@event_processed.connect(weak=False)
def record_sourcemaps_received(project, group, event, **kwargs):
    if event.data.get("sourcemap"):
        try:
            with transaction.atomic():
                OrganizationOnboardingTask.objects.create(
                    organization=project.organization,
                    task=OnboardingTask.SOURCEMAPS,
                    status=OnboardingTaskStatus.COMPLETE,
                    project=project,
                    date_completed=timezone.now()
                )
        except IntegrityError:
            pass

@plugin_enabled.connect(weak=False)
def record_plugin_enabled(plugin, project, user, **kwargs):
    if isinstance(plugin, IssueTrackingPlugin):
        task = OnboardingTask.ISSUE_TRACKER
        status = OnboardingTaskStatus.PENDING
    elif isinstance(plugin,  NotificationPlugin):
        task = OnboardingTask.NOTIFICATION_SERVICE
        status = OnboardingTaskStatus.COMPLETE

    try:
        with transaction.atomic():
            OrganizationOnboardingTask.objects.create(
                organization=project.organization,
                task=task,
                status=status,
                user=user,
                project=project,
                date_completed=timezone.now(),
                data={ 'plugin': plugin.slug }
            )
    except IntegrityError:
        pass

@issue_tracker_used.connect(weak=False)
def record_issue_tracker_used(plugin, project, user, **kwargs):
    OrganizationOnboardingTask.objects.create_or_update(
        organization=project.organization,
        task=OnboardingTask.ISSUE_TRACKER,
        status=OnboardingTaskStatus.PENDING,
        values={
            'status': OnboardingTaskStatus.COMPLETE,
            'user': user,
            'project': project,
            'date_completed': timezone.now(),
            'data': { 'plugin': plugin.slug }
        }
    )
