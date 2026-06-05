from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import APITestCase


class OrganizationLegacyWebhooksTest(APITestCase):
    endpoint = "sentry-api-0-organization-legacy-webhooks"
    method = "get"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_empty_when_no_webhooks_configured(self) -> None:
        response = self.get_success_response(self.organization.slug, status_code=200)
        assert response.data == {"projects": []}

    def test_returns_enabled_project(self) -> None:
        ProjectOption.objects.set_value(self.project, "webhooks:enabled", True)

        response = self.get_success_response(self.organization.slug, status_code=200)
        assert len(response.data["projects"]) == 1
        project_data = response.data["projects"][0]
        assert project_data["projectSlug"] == self.project.slug
        assert project_data["enabled"] is True

    def test_returns_disabled_project(self) -> None:
        ProjectOption.objects.set_value(self.project, "webhooks:enabled", False)

        response = self.get_success_response(self.organization.slug, status_code=200)
        assert len(response.data["projects"]) == 1
        project_data = response.data["projects"][0]
        assert project_data["projectSlug"] == self.project.slug
        assert project_data["enabled"] is False

    def test_multiple_projects_mixed_states(self) -> None:
        project_b = self.create_project(
            slug="proj-b", organization=self.organization, platform="react"
        )
        ProjectOption.objects.set_value(self.project, "webhooks:enabled", True)
        ProjectOption.objects.set_value(project_b, "webhooks:enabled", False)

        response = self.get_success_response(self.organization.slug, status_code=200)
        assert len(response.data["projects"]) == 2
        by_slug = {p["projectSlug"]: p for p in response.data["projects"]}
        assert by_slug[self.project.slug]["enabled"] is True
        assert by_slug["proj-b"]["enabled"] is False

    def test_excludes_deleted_projects(self) -> None:
        deleted_project = self.create_project(slug="deleted", organization=self.organization)
        ProjectOption.objects.set_value(deleted_project, "webhooks:enabled", True)
        deleted_project.delete()

        response = self.get_success_response(self.organization.slug, status_code=200)
        assert response.data == {"projects": []}
