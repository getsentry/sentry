from urllib.parse import quote

from django.urls import reverse

from sentry.models.environment import Environment, EnvironmentProject
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectEnvironmentsTest(APITestCase):
    def test_get(self):
        project = self.create_project()

        environment = Environment.objects.create(
            organization_id=project.organization_id, name="production"
        )
        environment.add_project(project)

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-environment-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "environment": "production",
            },
        )
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data == {
            "id": "{}".format(
                EnvironmentProject.objects.get(environment__name="production", project=project).id
            ),
            "name": "production",
            "isHidden": False,
        }

        assert (
            self.client.get(
                reverse(
                    "sentry-api-0-project-environment-details",
                    kwargs={
                        "organization_slug": project.organization.slug,
                        "project_slug": project.slug,
                        "environment": "invalid",
                    },
                ),
                format="json",
            ).status_code
            == 404
        )

    def test_put(self):
        project = self.create_project()

        environment = Environment.objects.create(
            organization_id=project.organization_id, name="production"
        )
        environment.add_project(project)

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-environment-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "environment": "production",
            },
        )
        response = self.client.put(url, {"isHidden": True}, format="json")
        assert response.status_code == 200, response.content

        assert (
            EnvironmentProject.objects.get(project=project, environment=environment).is_hidden
            is True
        )

        assert (
            self.client.put(
                reverse(
                    "sentry-api-0-project-environment-details",
                    kwargs={
                        "organization_slug": project.organization.slug,
                        "project_slug": project.slug,
                        "environment": "invalid",
                    },
                ),
                {"isHidden": True},
                format="json",
            ).status_code
            == 404
        )

    def test_escaped_character_put(self):
        project = self.create_project()

        # "/" character will have to be escaped in url path
        env_name = "PROD/STAGE"
        environment = Environment.objects.create(
            organization_id=project.organization_id, name=env_name
        )
        environment.add_project(project)

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-environment-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "environment": quote(env_name, safe=""),
            },
        )
        response = self.client.put(url, {"isHidden": True}, format="json")
        assert response.status_code == 200, response.content

        assert (
            EnvironmentProject.objects.get(project=project, environment=environment).is_hidden
            is True
        )
