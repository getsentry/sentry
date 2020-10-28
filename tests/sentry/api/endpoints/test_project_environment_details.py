from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Environment, EnvironmentProject
from sentry.testutils import APITestCase


class ProjectEnvironmentsTest(APITestCase):
    def test_get(self):
        project = self.create_project()

        environment = Environment.objects.create(
            project_id=project.id, organization_id=project.organization_id, name="production"
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
            "id": u"{}".format(
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
            project_id=project.id, organization_id=project.organization_id, name="production"
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
