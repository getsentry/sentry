from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class OrganizationIntegrationsListTest(APITestCase):
    endpoint = "sentry-api-0-organization-integrations"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.integration = self.create_integration(
            organization=self.organization,
            provider="example",
            name="Example",
            external_id="example:1",
        )

    def test_simple(self):
        response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.integration.id)
        assert "configOrganization" in response.data[0]

    def test_no_config(self):
        response = self.get_success_response(self.organization.slug, qs_params={"includeConfig": 0})

        assert "configOrganization" not in response.data[0]
