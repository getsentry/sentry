from django.urls import reverse

from sentry.models.environment import EnvironmentProject
from sentry.testutils.cases import APITestCase


class ProjectEnvironmentsTest(APITestCase):
    def test_simple(self) -> None:
        project = self.create_project()

        self.create_environment(project=project, name="production")
        self.create_environment(project=project, name="staging")

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-environments",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]["name"] == "production"
        assert response.data[1]["name"] == "staging"

    def test_visibility_filtering(self) -> None:
        project = self.create_project()

        self.create_environment(project=project, name="production", is_hidden=False)
        self.create_environment(project=project, name="staging", is_hidden=True)

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-environments",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["name"] == "production"

        response = self.client.get(url + "?visibility=all", format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]["name"] == "production"
        assert response.data[1]["name"] == "staging"

        response = self.client.get(url + "?visibility=hidden", format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["name"] == "staging"

    def test_bulk_put(self) -> None:
        project = self.create_project()

        env1 = self.create_environment(project=project, name="production")
        env2 = self.create_environment(project=project, name="staging")
        env3 = self.create_environment(project=project, name="development")

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-environments",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )

        response = self.client.put(
            url,
            {"environmentNames": ["production", "staging"], "isHidden": True},
            format="json",
        )
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]["name"] == "production"
        assert response.data[0]["isHidden"] is True
        assert response.data[1]["name"] == "staging"
        assert response.data[1]["isHidden"] is True

        assert EnvironmentProject.objects.get(project=project, environment=env1).is_hidden is True
        assert EnvironmentProject.objects.get(project=project, environment=env2).is_hidden is True
        assert EnvironmentProject.objects.get(project=project, environment=env3).is_hidden is None

    def test_bulk_put_nonexistent_environment_ignored(self) -> None:
        project = self.create_project()

        self.create_environment(project=project, name="production")

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-environments",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )

        response = self.client.put(
            url,
            {"environmentNames": ["production", "nonexistent"], "isHidden": True},
            format="json",
        )
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["name"] == "production"
        assert response.data[0]["isHidden"] is True

        assert (
            EnvironmentProject.objects.get(
                project=project, environment__name="production"
            ).is_hidden
            is True
        )
        assert not EnvironmentProject.objects.filter(
            project=project, environment__name="nonexistent"
        ).exists()

    def test_bulk_put_validation_errors(self) -> None:
        project = self.create_project()

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-environments",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )

        response = self.client.put(url, {}, format="json")
        assert response.status_code == 400

        response = self.client.put(url, {"environmentNames": [], "isHidden": True}, format="json")
        assert response.status_code == 400

        response = self.client.put(url, {"environmentNames": ["production"]}, format="json")
        assert response.status_code == 400

        response = self.client.put(
            url,
            {"environmentNames": [f"env-{i}" for i in range(1001)], "isHidden": True},
            format="json",
        )
        assert response.status_code == 400

    def test_bulk_put_no_project_access(self) -> None:
        project = self.create_project()
        self.create_environment(project=project, name="production")

        other_user = self.create_user()
        self.login_as(user=other_user)

        url = reverse(
            "sentry-api-0-project-environments",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )

        response = self.client.put(
            url,
            {"environmentNames": ["production"], "isHidden": True},
            format="json",
        )
        assert response.status_code == 403
