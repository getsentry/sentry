from sentry.integrations.jsm.integration import JsmIntegrationProvider
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.silo import control_silo_test

EXTERNAL_ID = "test-app"
METADATA = {
    "api_key": "1234-ABCD",
    "base_url": "https://api.atlassian.com/",
    "domain_name": "test-app.atlassian.net",
}


@control_silo_test
class JsmIntegrationTest(IntegrationTestCase):
    provider = JsmIntegrationProvider
    config_no_key = {
        "base_url": "https://api.atlassian.com/",
        "provider": "cool-name",
        "api_key": "",
    }
    config_with_key = {
        "base_url": "https://api.atlassian.com/",
        "provider": "cool-name",
        "api_key": "123-key",
    }
    custom_config_no_key = {
        "base_url": "https://api.atlassian.com/",
        "custom_url": "https://custom.jsm.example.com/",
        "provider": "custom-name",
        "api_key": "",
    }
    custom_config_with_key = {
        "base_url": "https://api.atlassian.com/",
        "custom_url": "https://custom.jsm.example.com/",
        "provider": "custom-name",
        "api_key": "123-key",
    }

    def assert_setup_flow(self, config):
        resp = self.client.get(self.init_path)
        assert resp.status_code == 200
        resp = self.client.post(self.init_path, data=config)
        assert resp.status_code == 200
        return resp

    def test_integration_with_key(self):
        self.assert_setup_flow(self.config_with_key)

        integration = Integration.objects.get(provider=self.provider.key)
        org_integration = OrganizationIntegration.objects.get(integration_id=integration.id)

        assert org_integration.config["team_table"] == [
            {
                "team": "my-first-key",
                "id": f"{org_integration.id}-my-first-key",
                "integration_key": "123-key",
            }
        ]
        assert org_integration.organization_id == self.organization.id
        assert integration.external_id == "cool-name"
        assert integration.name == "cool-name"
        assert integration.metadata == {
            "api_key": "123-key",
            "base_url": "https://api.atlassian.com/",
            "domain_name": "cool-name.atlassian.net",
        }

    def test_integration_no_key(self):
        self.assert_setup_flow(self.config_no_key)

        integration = Integration.objects.get(provider=self.provider.key)
        org_integration = OrganizationIntegration.objects.get(integration_id=integration.id)

        assert org_integration.config["team_table"] == []
        assert org_integration.organization_id == self.organization.id
        assert integration.external_id == "cool-name"
        assert integration.name == "cool-name"
        assert integration.metadata == {
            "api_key": "",
            "base_url": "https://api.atlassian.com/",
            "domain_name": "cool-name.atlassian.net",
        }

    def test_integration_custom_url(self):
        self.assert_setup_flow(self.custom_config_with_key)

        integration = Integration.objects.get(provider=self.provider.key)
        org_integration = OrganizationIntegration.objects.get(integration_id=integration.id)

        assert org_integration.config["team_table"] == [
            {
                "team": "my-first-key",
                "id": f"{org_integration.id}-my-first-key",
                "integration_key": "123-key",
            }
        ]
        assert org_integration.organization_id == self.organization.id
        assert integration.external_id == "custom-name"
        assert integration.name == "custom-name"
        assert integration.metadata == {
            "api_key": "123-key",
            "base_url": "https://custom.jsm.example.com/",
            "domain_name": "custom-name.atlassian.net",
        }
