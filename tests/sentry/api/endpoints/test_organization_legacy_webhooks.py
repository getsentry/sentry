from django.urls import reverse

from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import APITestCase


class OrganizationLegacyWebhooksTest(APITestCase):
    def setUp(self) -> None:
        self.project_a = self.create_project(slug="proj-a")
        self.organization = self.project_a.organization
        self.project_b = self.create_project(
            slug="proj-b", organization=self.organization, platform="react"
        )

        self.url = reverse(
            "sentry-api-0-organization-legacy-webhooks",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

        self.login_as(user=self.user)

    def test_empty_when_no_webhooks_enabled(self) -> None:
        response = self.client.get(self.url)
        assert response.status_code == 200
        assert response.data == {"projects": []}

    def test_returns_enabled_project(self) -> None:
        ProjectOption.objects.set_value(self.project_a, "webhooks:enabled", True)

        response = self.client.get(self.url)
        assert response.status_code == 200
        assert len(response.data["projects"]) == 1
        project_data = response.data["projects"][0]
        assert project_data["projectSlug"] == "proj-a"
        assert project_data["enabled"] is True

    def test_excludes_disabled_projects(self) -> None:
        ProjectOption.objects.set_value(self.project_a, "webhooks:enabled", False)

        response = self.client.get(self.url)
        assert response.status_code == 200
        assert response.data == {"projects": []}

    def test_multiple_projects(self) -> None:
        ProjectOption.objects.set_value(self.project_a, "webhooks:enabled", True)
        ProjectOption.objects.set_value(self.project_b, "webhooks:enabled", True)

        response = self.client.get(self.url)
        assert response.status_code == 200
        assert len(response.data["projects"]) == 2
        slugs = [p["projectSlug"] for p in response.data["projects"]]
        assert slugs == ["proj-a", "proj-b"]

    def test_excludes_deleted_projects(self) -> None:
        deleted_project = self.create_project(slug="deleted", organization=self.organization)
        ProjectOption.objects.set_value(deleted_project, "webhooks:enabled", True)
        deleted_project.delete()

        response = self.client.get(self.url)
        assert response.status_code == 200
        assert response.data == {"projects": []}

    def test_requires_authentication(self) -> None:
        self.client.logout()
        response = self.client.get(self.url)
        assert response.status_code == 401
