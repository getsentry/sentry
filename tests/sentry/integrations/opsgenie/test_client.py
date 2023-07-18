import responses

from sentry.models import Integration, OrganizationIntegration
from sentry.testutils import APITestCase

EXTERNAL_ID = "test-app"
METADATA = {
    "api_key": "1234-ABCD",
    "base_url": "https://api.opsgenie.com/",
    "domain_name": "test-app.app.opsgenie.com",
}


class OpsgenieClientTest(APITestCase):
    def setUp(self) -> None:
        self.login_as(self.user)
        self.integration = Integration.objects.create(
            provider="opsgenie", name="test-app", external_id=EXTERNAL_ID, metadata=METADATA
        )
        self.integration.add_organization(self.organization, self.user)
        self.installation = self.integration.get_installation(self.organization.id)

    def test_get_client(self):
        client = self.installation.get_client()
        assert client.integration == self.installation.model
        assert client.base_url == METADATA["base_url"] + "v2"
        assert client.api_key == METADATA["api_key"]

    @responses.activate
    def test_get_team_id(self):
        client = self.installation.get_client()

        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration_id=self.integration.id
        )
        org_integration.config = {
            "team_table": [{"id": "", "team": "cool-team", "integration_key": "1234-5678"}]
        }
        org_integration.save()
        resp_data = {"data": {"id": "123-id", "name": "cool-team"}}
        responses.add(responses.GET, url=f"{client.base_url}/teams/cool-team", json=resp_data)

        resp = client.get_team_id(integration_key="123-key", team_name="cool-team")
        assert resp == resp_data
