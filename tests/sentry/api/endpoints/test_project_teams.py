from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class ProjectTeamsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)
        team = self.create_team()
        project = self.create_project(teams=[team])

        path = reverse(
            "sentry-api-0-project-teams",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        response = self.client.get(path, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["slug"] == team.slug
        assert response.data[0]["name"] == team.name
