import pytest
import responses
from rest_framework.serializers import ValidationError

from sentry.integrations.opsgenie.integration import OpsgenieIntegrationProvider
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.silo import control_silo_test

EXTERNAL_ID = "test-app"
METADATA = {
    "api_key": "1234-ABCD",
    "base_url": "https://api.opsgenie.com/",
    "domain_name": "test-app.app.opsgenie.com",
}


@control_silo_test(stable=True)
class OpsgenieIntegrationTest(IntegrationTestCase):
    provider = OpsgenieIntegrationProvider
    config_no_key = {
        "base_url": "https://api.opsgenie.com/",
        "provider": "cool-name",
        "api_key": "",
    }
    config_with_key = {
        "base_url": "https://api.opsgenie.com/",
        "provider": "cool-name",
        "api_key": "123-key",
    }

    def setUp(self):
        super().setUp()
        self.init_path_without_guide = f"{self.init_path}?completed_installation_guide"

    def assert_setup_flow(self, config):
        resp = self.client.get(self.init_path)
        assert resp.status_code == 200

        resp = self.client.post(self.init_path, data=config)
        assert resp.status_code == 200

    def test_installation_no_key(self):
        self.assert_setup_flow(self.config_no_key)

        integration = Integration.objects.get(provider=self.provider.key)
        org_integration = OrganizationIntegration.objects.get(integration_id=integration.id)

        assert org_integration.config["team_table"] == []
        assert org_integration.organization_id == self.organization.id
        assert integration.external_id == "cool-name"
        assert integration.name == "cool-name"

    def test_installation_with_key(self):
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

    @responses.activate
    def test_update_config_valid(self):
        integration = Integration.objects.create(
            provider="opsgenie", name="test-app", external_id=EXTERNAL_ID, metadata=METADATA
        )

        integration.add_organization(self.organization, self.user)
        installation = integration.get_installation(self.organization.id)

        integration = Integration.objects.get(provider=self.provider.key)
        org_integration = OrganizationIntegration.objects.get(integration_id=integration.id)

        data = {"team_table": [{"id": "", "team": "cool-team", "integration_key": "1234-5678"}]}
        installation.update_organization_config(data)
        team_id = str(org_integration.id) + "-" + "cool-team"
        assert installation.get_config_data() == {
            "team_table": [{"id": team_id, "team": "cool-team", "integration_key": "1234-5678"}]
        }

    @responses.activate
    def test_update_config_invalid(self):
        integration = Integration.objects.create(
            provider="opsgenie", name="test-app", external_id=EXTERNAL_ID, metadata=METADATA
        )

        integration.add_organization(self.organization, self.user)
        installation = integration.get_installation(self.organization.id)

        org_integration = OrganizationIntegration.objects.get(integration_id=integration.id)
        team_id = str(org_integration.id) + "-" + "cool-team"

        # valid
        data = {"team_table": [{"id": "", "team": "cool-team", "integration_key": "1234"}]}
        installation.update_organization_config(data)
        assert installation.get_config_data() == {
            "team_table": [{"id": team_id, "team": "cool-team", "integration_key": "1234"}]
        }

        # try duplicate name
        data = {
            "team_table": [
                {"id": team_id, "team": "cool-team", "integration_key": "1234"},
                {"id": "", "team": "cool-team", "integration_key": "1234"},
            ]
        }
        with pytest.raises(ValidationError):
            installation.update_organization_config(data)
        assert installation.get_config_data() == {
            "team_table": [{"id": team_id, "team": "cool-team", "integration_key": "1234"}]
        }
