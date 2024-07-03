from django.urls import reverse

from sentry.testutils.cases import APITestCase


class ProjectProjectProcessingIssuesTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        team = self.create_team()
        project1 = self.create_project(teams=[team], name="foo")

        url = reverse(
            "sentry-api-0-project-processing-issues",
            kwargs={
                "organization_id_or_slug": project1.organization.slug,
                "project_id_or_slug": project1.slug,
            },
        )
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["hasIssues"] is False
        assert response.data["hasMoreResolveableIssues"] is False
        assert response.data["numIssues"] == 0
        assert response.data["issuesProcessing"] == 0
        assert response.data["resolveableIssues"] == 0
