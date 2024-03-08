from sentry.testutils.cases import APITestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class OrganizationProjectsTestBase(APITestCase):
    endpoint = "sentry-api-0-organization-lightweight-projects"

    def test_simple(self):
        self.login_as(user=self.user)
        project1 = self.create_project(teams=[self.team], platform="javascript")
        project2 = self.create_project(teams=[self.team], platform="python")

        self.create_environment(project=project1, name="production")
        self.create_environment(project=project2, name="staging")

        response = self.get_success_response(self.organization.slug)
        assert sorted(response.data, key=lambda x: x["id"]) == [
            {
                "environments": ["production"],
                "id": project1.id,
                "slug": project1.slug,
                "isMember": True,
                "platform": "javascript",
            },
            {
                "environments": ["staging"],
                "id": project2.id,
                "slug": project2.slug,
                "isMember": True,
                "platform": "python",
            },
        ]
