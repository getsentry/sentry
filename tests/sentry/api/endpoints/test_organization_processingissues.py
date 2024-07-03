from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time


class OrganizationProcessingIssuesTest(APITestCase):
    endpoint = "sentry-api-0-organization-processing-issues"

    def setUp(self):
        self.login_as(user=self.user)
        self.other_project = self.create_project(teams=[self.team], name="other")

    @freeze_time()
    def test_simple(self):
        response = self.get_success_response(
            self.project.organization.slug, project=[self.project.id]
        )
        assert len(response.data) == 1
        assert response.data[0]["hasIssues"] is False

        response = self.get_success_response(
            self.project.organization.slug, project=[self.project.id, self.other_project.id]
        )
        assert len(response.data) == 2
