from sentry.models import Integration, OrganizationIntegration
from sentry.testutils import APITestCase


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
