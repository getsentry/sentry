from __future__ import absolute_import

from django.utils import timezone

from sentry.models import (
    OnboardingTask, OnboardingTaskStatus, OrganizationOnboardingTask
)
from sentry.signals import first_event
from sentry.testutils import TestCase


class RecordFirstEventTest(TestCase):
    def test_no_existing_task(self):
        project = self.create_project(first_event=timezone.now())

        first_event.send(instance=project, sender=type(project))

        task = OrganizationOnboardingTask.objects.get(
            organization=project.organization,
            task=OnboardingTask.FIRST_EVENT
        )
        assert task.status == OnboardingTaskStatus.COMPLETE
        assert task.project == project
        assert task.date == project.first_seen

    def test_existing_pending_task(self):
        project = self.create_project(first_event=timezone.now())
        task = OrganizationOnboardingTask.objects.create(
            organization=project.organization,
            task=OnboardingTask.FIRST_EVENT,
            status=OnboardingTaskStatus.PENDING,
        )

        first_event.send(instance=project, sender=type(project))

        task = OrganizationOnboardingTask.objects.get(id=task.id)
        assert task.status == OnboardingTaskStatus.COMPLETE
        assert task.project == project
        assert task.date == project.first_seen

    def test_existing_complete_task(self):
        project = self.create_project(first_event=timezone.now())
        task = OrganizationOnboardingTask.objects.create(
            organization=project.organization,
            task=OnboardingTask.FIRST_EVENT,
            status=OnboardingTaskStatus.COMPLETE,
        )

        first_event.send(instance=project, sender=type(project))

        task = OrganizationOnboardingTask.objects.get(id=task.id)
        assert task.status == OnboardingTaskStatus.COMPLETE
        assert not task.project
