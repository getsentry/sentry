from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
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
        integration = Integration.objects.create(provider="github")

        OrganizationIntegration.objects.create(
            organization_id=self.organization.id, integration_id=integration.id
        )

        response = self.get_success_response(self.user.id)
        assert response.data[0]["organizationId"] == self.organization.id
