from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import OrganizationOnboardingTask, OnboardingTask, OnboardingTaskStatus
from sentry.testutils import APITestCase


class OrganizationOnboardingTaskEndpointTest(APITestCase):
    def setUp(self):
        self.user = self.create_user()
        self.member_user = self.create_user()
        self.org = self.create_organization(owner=self.user)
        self.create_member(organization=self.org, user=self.member_user)
        self.login_as(user=self.user)
        self.path = reverse("sentry-api-0-organization-onboardingtasks", args=[self.org.slug])

    def test_mark_complete(self):
        response = self.client.post(self.path, {"task": "create_project", "status": "complete"})

        assert response.status_code == 204, response.content

        task = OrganizationOnboardingTask.objects.get(
            organization=self.org, task=OnboardingTask.FIRST_PROJECT
        )

        assert task.status == OnboardingTaskStatus.COMPLETE
        assert task.completion_seen is None
        assert task.user == self.user

    def test_mark_completion_seen(self):
        response = self.client.post(self.path, {"task": "create_project", "status": "complete"})
        assert response.status_code == 204, response.content

        response = self.client.post(self.path, {"task": "create_project", "completionSeen": True})

        assert response.status_code == 204, response.content

        task = OrganizationOnboardingTask.objects.get(
            organization=self.org, task=OnboardingTask.FIRST_PROJECT
        )

        assert task.completion_seen is not None

    def test_mark_completion_seen_as_member(self):
        self.login_as(self.member_user)

        response = self.client.post(self.path, {"task": "create_project", "status": "complete"})
        assert response.status_code == 204, response.content

        response = self.client.post(self.path, {"task": "create_project", "completionSeen": True})

        assert response.status_code == 204, response.content

        task = OrganizationOnboardingTask.objects.get(
            organization=self.org, task=OnboardingTask.FIRST_PROJECT
        )

        assert task.completion_seen is not None

    def test_cannot_skip_unskippable(self):
        response = self.client.post(self.path, {"task": "create_project", "status": "skipped"})

        assert response.status_code == 422, response.content
        assert not OrganizationOnboardingTask.objects.filter(
            organization=self.org, task=OnboardingTask.FIRST_PROJECT
        ).exists()

    def test_invalid_status_key(self):
        response = self.client.post(self.path, {"task": "create_project", "status": "bad_status"})

        assert response.status_code == 422, response.content
        assert response.data["detail"] == "Invalid status key"
        assert not OrganizationOnboardingTask.objects.filter(
            organization=self.org, task=OnboardingTask.FIRST_PROJECT
        ).exists()

    def test_invalid_task_key(self):
        response = self.client.post(self.path, {"task": "bad_key"})

        assert response.status_code == 422, response.content
        assert response.data["detail"] == "Invalid task key"
        assert not OrganizationOnboardingTask.objects.filter(
            organization=self.org, task=OnboardingTask.FIRST_PROJECT
        ).exists()

    def test_missing_status_or_completion_seen(self):
        response = self.client.post(self.path, {"task": "create_project"})

        assert response.status_code == 422, response.content
        assert response.data["detail"] == "completionSeen or status must be provided"

        assert not OrganizationOnboardingTask.objects.filter(
            organization=self.org, task=OnboardingTask.FIRST_PROJECT
        ).exists()
