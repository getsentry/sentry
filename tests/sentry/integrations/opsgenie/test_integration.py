import pytest
import responses

from sentry.integrations.opsgenie.integration import OpsgenieIntegrationProvider
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.testutils import IntegrationTestCase
from sentry.utils import json


class OpsgenieIntegrationTest(IntegrationTestCase):
    provider = OpsgenieIntegrationProvider
    config = {"base_url": "https://api.opsgenie.com/", "api_key": "123"}

    def setUp(self):
        super().setUp()
        self.init_path_without_guide = f"{self.init_path}?completed_installation_guide"

    def assert_setup_flow(self, name="cool-name"):
        resp_data = {"data": {"name": name}}
        responses.add(
            responses.GET,
            url="{}{}".format(self.config["base_url"].rstrip("/"), "/v2/account"),
            json=resp_data,
        )

        resp = self.client.get(self.init_path)
        assert resp.status_code == 200

        resp = self.client.get(self.init_path_without_guide)
        assert resp.status_code == 200

        resp = self.client.post(self.init_path_without_guide, data=self.config)
        assert resp.status_code == 200

        mock_request = responses.calls[0].request

        assert mock_request.headers["Authorization"] == "GenieKey " + self.config["api_key"]

        mock_response = responses.calls[0].response
        assert json.loads(mock_response.content) == resp_data

    @responses.activate
    def test_installation(self):
        self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)
        org_integration = OrganizationIntegration.objects.get(integration_id=integration.id)
        assert org_integration.organization_id == self.organization.id
        assert integration.external_id == "cool-name"
        assert integration.name == "cool-name"

    @responses.activate
    def test_goback_to_instructions(self):
        # Go to instructions
        resp = self.client.get(self.init_path)
        assert resp.status_code == 200
        self.assertContains(resp, "Step 1")

        # Go to setup form
        resp = self.client.get(self.init_path_without_guide)
        assert resp.status_code == 200
        self.assertContains(resp, "Step 2")

        # Go back to instructions
        resp = self.client.get(self.init_path + "?goback=1")
        assert resp.status_code == 200
        self.assertContains(resp, "Step 1")

    @responses.activate
    def test_invalid_key(self):
        provider = self.provider()
        bad_key = "bad"
        with pytest.raises(IntegrationError) as error:
            provider.get_account_info(base_url=self.config["base_url"], api_key=bad_key)
        assert str(error.value) == "The requested Opsgenie account could not be found."

    def test_invalid_url(self):
        provider = self.provider()
        bad_url = "bad.com"
        with pytest.raises(IntegrationError) as error:
            provider.get_account_info(base_url=bad_url, api_key=self.config["api_key"])
        assert str(error.value) == "Invalid URL provided."
