from django.urls import reverse

from sentry.testutils import APITestCase


class ProjectCreateSampleTest(APITestCase):
    def setUp(self):
        self.login_as(user=self.user)
        self.team = self.create_team()

    def test_simple(self):
        project = self.create_project(teams=[self.team], name="foo")

        url = reverse(
            "sentry-api-0-project-create-sample-transaction",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.post(url, format="json")

        assert response.status_code == 200, response.content
