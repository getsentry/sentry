from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class UserOrganizationIntegationTest(APITestCase):
    endpoint = "sentry-api-0-user-organization-integrations"
    method = "get"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_simple(self):
        integration = self.create_provider_integration(provider="github")

        self.create_organization_integration(
            organization_id=self.organization.id, integration_id=integration.id
        )

        response = self.get_success_response(self.user.id)
        assert response.data[0]["organizationId"] == self.organization.id
