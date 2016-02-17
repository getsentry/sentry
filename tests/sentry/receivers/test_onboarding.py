from __future__ import absolute_import

from django.utils import timezone

from sentry.models import (
    OnboardingTask, OnboardingTaskStatus, OrganizationOnboardingTask
)
from sentry.signals import first_event_pending, first_event_received
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
        assert task.project == project
        assert task.date_completed == project.first_event

    def test_existing_pending_task(self):
        project = self.create_project(first_event=timezone.now())

        first_event_pending.send(project=project, user=self.user, sender=type(project))

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.FIRST_EVENT,
        )

        assert task.status == OnboardingTaskStatus.PENDING
        assert task.project == project

        first_event_received.send(project=project, group=self.group, sender=type(project))

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.FIRST_EVENT,
        )

        assert task.status == OnboardingTaskStatus.COMPLETE
        assert task.project == project
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
        assert not task.project
