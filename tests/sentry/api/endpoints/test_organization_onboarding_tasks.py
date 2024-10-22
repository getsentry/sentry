from django.urls import reverse

from sentry.models.organizationonboardingtask import (
    OnboardingTask,
    OnboardingTaskStatus,
    OrganizationOnboardingTask,
)
from sentry.testutils.cases import APITestCase


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
        assert task.user_id == self.user.id

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

    def test_get_tasks(self):
        # create a task
        self.client.post(self.path, {"task": "create_project", "status": "complete"})

        # get tasks
        response = self.client.get(self.path)
        assert response.status_code == 200, response.content

        # Verify that the response contains the 'onboardingTasks' key
        assert "onboardingTasks" in response.data
        tasks = response.data["onboardingTasks"]

        # Verify that the 'create_project' task is in the list of onboarding tasks
        create_project_task = next(
            (task for task in tasks if task["task"] == "create_project"), None
        )
        assert create_project_task is not None
        assert create_project_task["status"] == "complete"
