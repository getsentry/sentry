from __future__ import absolute_import

from django.utils import timezone

from sentry.models import (
    OnboardingTask, OnboardingTaskStatus, OrganizationOnboardingTask
)
from sentry.signals import (
    event_processed,
    project_created,
    first_event_pending,
    first_event_received,
    member_invited,
    member_joined,
    plugin_enabled,
    issue_tracker_used,
)
from sentry.plugins import IssueTrackingPlugin, NotificationPlugin
from sentry.testutils import TestCase


class OrganizationOnboardingTaskTest(TestCase):
    def test_no_existing_task(self):
        project = self.create_project(first_event=timezone.now())
        first_event_received.send(project=project, group=self.group, sender=type(project))

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.FIRST_EVENT
        )
        assert task.status == OnboardingTaskStatus.COMPLETE
        assert task.project_id == project.id
        assert task.date_completed == project.first_event

    def test_existing_pending_task(self):
        project = self.create_project(first_event=timezone.now())

        first_event_pending.send(project=project, user=self.user, sender=type(project))

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.FIRST_EVENT,
        )

        assert task.status == OnboardingTaskStatus.PENDING
        assert task.project_id == project.id

        first_event_received.send(project=project, group=self.group, sender=type(project))

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.FIRST_EVENT,
        )

        assert task.status == OnboardingTaskStatus.COMPLETE
        assert task.project_id == project.id
        assert task.date_completed == project.first_event

    def test_existing_complete_task(self):
        project = self.create_project(first_event=timezone.now())
        task = OrganizationOnboardingTask.objects.create(
            organization=project.organization,
            task=OnboardingTask.FIRST_PROJECT,
            status=OnboardingTaskStatus.COMPLETE,
        )

        first_event_received.send(project=project, group=self.group, sender=type(project))

        task = OrganizationOnboardingTask.objects.get(id=task.id)
        assert task.status == OnboardingTaskStatus.COMPLETE
        assert not task.project_id

    # Tests on the receivers
    def test_event_processed(self):
        project = self.create_project(first_event=timezone.now())
        event = self.create_full_event()
        event_processed.send(project=project, group=self.group, event=event, sender=type(project))

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.RELEASE_TRACKING,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.USER_CONTEXT,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.SOURCEMAPS,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

    def test_project_created(self):
        project = self.create_project(first_event=timezone.now())
        project_created.send(project=project, user=self.user, sender=type(project))

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.FIRST_PROJECT,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

    def test_first_event_pending(self):
        project = self.create_project(first_event=timezone.now())
        first_event_pending.send(project=project, user=self.user, sender=type(project))

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.FIRST_EVENT,
            status=OnboardingTaskStatus.PENDING,
        )
        assert task is not None

    def test_first_event_received(self):
        project = self.create_project(first_event=timezone.now())
        first_event_received.send(project=project, group=self.group, sender=type(project))

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.FIRST_EVENT,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

    def test_member_invited(self):
        user = self.create_user(email='test@example.org')
        member = self.create_member(organization=self.organization, teams=[self.team], user=user)
        member_invited.send(member=member, user=user, sender=type(member))

        task = OrganizationOnboardingTask.objects.get(
            organization=self.organization,
            task=OnboardingTask.INVITE_MEMBER,
            status=OnboardingTaskStatus.PENDING,
        )
        assert task is not None

    def test_member_joined(self):
        user = self.create_user(email='test@example.org')
        member = self.create_member(organization=self.organization, teams=[self.team], user=user)
        member_joined.send(member=member, sender=type(member))

        task = OrganizationOnboardingTask.objects.get(
            organization=self.organization,
            task=OnboardingTask.INVITE_MEMBER,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

        user2 = self.create_user(email='test@example.com')
        member2 = self.create_member(organization=self.organization, teams=[self.team], user=user2)
        member_joined.send(member=member2, sender=type(member2))

        task = OrganizationOnboardingTask.objects.get(
            organization=self.organization,
            task=OnboardingTask.INVITE_MEMBER,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task.data['invited_member_id'] == member.id

    def test_issue_tracker_onboarding(self):
        plugin_enabled.send(plugin=IssueTrackingPlugin(), project=self.project, user=self.user, sender=type(IssueTrackingPlugin))
        task = OrganizationOnboardingTask.objects.get(
            organization=self.organization,
            task=OnboardingTask.ISSUE_TRACKER,
            status=OnboardingTaskStatus.PENDING,
        )
        assert task is not None

        issue_tracker_used.send(plugin=IssueTrackingPlugin(), project=self.project, user=self.user, sender=type(IssueTrackingPlugin))
        task = OrganizationOnboardingTask.objects.get(
            organization=self.organization,
            task=OnboardingTask.ISSUE_TRACKER,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None

    def test_notification_added(self):
        plugin_enabled.send(plugin=NotificationPlugin(), project=self.project, user=self.user, sender=type(NotificationPlugin))
        task = OrganizationOnboardingTask.objects.get(
            organization=self.organization,
            task=OnboardingTask.NOTIFICATION_SERVICE,
            status=OnboardingTaskStatus.COMPLETE,
        )
        assert task is not None
