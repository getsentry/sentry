from typing import int
from django.urls import reverse

from sentry.sentry_apps.models.servicehook import ServiceHook, ServiceHookProject
from sentry.testutils.cases import APITestCase


class SentryAppInstallationServiceHookProjectsEndpointTest(APITestCase):
    def setUp(self) -> None:
        self.user = self.create_user(email="boop@example.com")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.project2 = self.create_project(organization=self.org)
        self.project3 = self.create_project(organization=self.org)

        self.sentry_app = self.create_sentry_app(
            name="Testin",
            organization=self.org,
            webhook_url="https://example.com",
            scopes=["org:admin", "org:integrations", "event:admin"],
        )

        self.install = self.create_sentry_app_installation(
            organization=self.org, slug=self.sentry_app.slug, user=self.user
        )

        self.api_token = self.create_internal_integration_token(
            install=self.install, user=self.user  # using same install for auth token and webhooks
        )

        self.service_hook = ServiceHook.objects.get(
            installation_id=self.install.id,
        )

        self.url = reverse(
            "sentry-api-0-sentry-app-installation-service-hook-projects", args=[self.install.uuid]
        )

    def test_get_service_hook_projects(self) -> None:
        # Create a service hook project
        ServiceHookProject.objects.create(
            project_id=self.project.id, service_hook_id=self.service_hook.id
        )

        response = self.client.get(
            self.url, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["project_id"] == str(self.project.id)

    def test_post_service_hook_projects(self) -> None:
        ServiceHookProject.objects.create(
            project_id=self.project2.id, service_hook_id=self.service_hook.id
        )
        ServiceHookProject.objects.create(
            project_id=self.project3.id, service_hook_id=self.service_hook.id
        )

        data = {"projects": [self.project.id, self.project2.id]}

        response = self.client.post(
            self.url, data=data, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 200
        assert len(response.data) == 2

        response_data = {response.data[0]["project_id"], response.data[1]["project_id"]}
        assert response_data == {str(self.project.id), str(self.project2.id)}

        # Verify both projects are in the database
        hook_projects = ServiceHookProject.objects.filter(service_hook_id=self.service_hook.id)
        assert hook_projects.count() == 2
        project_ids = {hp.project_id for hp in hook_projects}
        assert project_ids == {self.project.id, self.project2.id}

    def test_post_service_hook_projects_mixed_types(self) -> None:
        data = {"projects": [self.project.slug, self.project2.id]}

        response = self.client.post(
            self.url, data=data, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 400

    def test_post_service_hook_projects_with_invalid_project(self) -> None:
        data = {"projects": ["invalid-project"]}

        response = self.client.post(
            self.url, data=data, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 400

    def test_post_service_hook_projects_without_projects(self) -> None:
        response = self.client.post(
            self.url, data={}, format="json", HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}"
        )
        assert response.status_code == 400

    def test_delete_service_hook_projects(self) -> None:
        # Create some service hook projects first
        ServiceHookProject.objects.create(
            project_id=self.project.id, service_hook_id=self.service_hook.id
        )
        ServiceHookProject.objects.create(
            project_id=self.project2.id, service_hook_id=self.service_hook.id
        )

        response = self.client.delete(self.url, HTTP_AUTHORIZATION=f"Bearer {self.api_token.token}")
        assert response.status_code == 204

        # Verify all hook projects were deleted
        assert ServiceHookProject.objects.filter(service_hook_id=self.service_hook.id).count() == 0
