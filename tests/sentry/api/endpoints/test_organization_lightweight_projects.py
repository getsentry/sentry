from sentry.testutils.cases import APITestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


class OrganizationProjectsTestBase(APITestCase):
    endpoint = "sentry-api-0-organization-lightweight-projects"

    def test_simple(self):
        self.login_as(user=self.user)
        self.create_project(teams=[self.team])

        response = self.get_success_response(self.organization.slug)
        assert response.data == [{}]
