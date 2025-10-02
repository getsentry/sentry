from unittest.mock import MagicMock, patch

import pytest
import responses
from rest_framework.serializers import ValidationError

from sentry.integrations.jsm.integration import JsmIntegrationProvider
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.shared_integrations.exceptions import ApiRateLimitedError, ApiUnauthorized
from sentry.testutils.asserts import assert_success_metric
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.helpers.features import with_feature
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

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_installation_no_key(self, mock_record: MagicMock) -> None:
        self.assert_setup_flow(self.config_no_key)

        # SLO assertions
        assert_success_metric(mock_record)

        integration = Integration.objects.get(provider=self.provider.key)
        org_integration = OrganizationIntegration.objects.get(integration_id=integration.id)

        assert org_integration.config["team_table"] == []
        assert org_integration.organization_id == self.organization.id
        assert org_integration.config == {"team_table": []}
        assert integration.external_id == "cool-name"
        assert integration.name == "cool-name"
        assert integration.metadata["domain_name"] == "cool-name.atlassian.net"

    def test_installation_with_key(self) -> None:
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
        assert integration.metadata["domain_name"] == "cool-name.atlassian.net"

    def test_custom_url_installation_no_key(self) -> None:
        self.assert_setup_flow(self.custom_config_no_key)

        integration = Integration.objects.get(provider=self.provider.key)
        org_integration = OrganizationIntegration.objects.get(integration_id=integration.id)

        assert org_integration.config["team_table"] == []
        assert org_integration.organization_id == self.organization.id
        assert org_integration.config == {"team_table": []}
        assert integration.external_id == "custom-name"
        assert integration.name == "custom-name"
        assert integration.metadata == {
            "api_key": "",
            "base_url": "https://custom.jsm.example.com/",
            "domain_name": "custom-name.atlassian.net",
        }

    def test_custom_url_installation_with_key(self) -> None:
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

    @responses.activate
    def test_update_config_valid(self) -> None:
        integration = self.create_provider_integration(
            provider="jsm", name="test-app", external_id=EXTERNAL_ID, metadata=METADATA
        )

        integration.add_organization(self.organization, self.user)
        installation = integration.get_installation(self.organization.id)

        integration = Integration.objects.get(provider=self.provider.key)
        org_integration = OrganizationIntegration.objects.get(integration_id=integration.id)

        responses.add(
            responses.GET, url="https://api.atlassian.com/v2/alerts?limit=1", status=200, json={}
        )

        data = {"team_table": [{"id": "", "team": "cool-team", "integration_key": "1234-5678"}]}
        installation.update_organization_config(data)
        team_id = str(org_integration.id) + "-" + "cool-team"
        assert installation.get_config_data() == {
            "team_table": [{"id": team_id, "team": "cool-team", "integration_key": "1234-5678"}]
        }

    @responses.activate
    def test_update_config_invalid(self) -> None:
        integration = self.create_provider_integration(
            provider="jsm", name="test-app", external_id=EXTERNAL_ID, metadata=METADATA
        )

        integration.add_organization(self.organization, self.user)
        installation = integration.get_installation(self.organization.id)

        org_integration = OrganizationIntegration.objects.get(integration_id=integration.id)
        team_id = str(org_integration.id) + "-" + "cool-team"

        responses.add(
            responses.GET, url="https://api.atlassian.com/v2/alerts?limit=1", status=200, json={}
        )

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

    @responses.activate
    def test_update_config_invalid_rate_limited(self) -> None:
        integration = self.create_provider_integration(
            provider="jsm", name="test-app", external_id=EXTERNAL_ID, metadata=METADATA
        )
        integration.add_organization(self.organization, self.user)
        installation = integration.get_installation(self.organization.id)

        data = {
            "team_table": [
                {"id": "", "team": "rad-team", "integration_key": "4321"},
                {"id": "cool-team", "team": "cool-team", "integration_key": "1234"},
            ]
        }
        responses.add(responses.GET, url="https://api.atlassian.com/v2/alerts?limit=1", status=429)

        with pytest.raises(ApiRateLimitedError):
            installation.update_organization_config(data)

    @responses.activate
    def test_update_config_invalid_integration_key(self) -> None:
        integration = self.create_provider_integration(
            provider="jsm", name="test-app", external_id=EXTERNAL_ID, metadata=METADATA
        )
        integration.add_organization(self.organization, self.user)
        installation = integration.get_installation(self.organization.id)

        data = {
            "team_table": [
                {"id": "cool-team", "team": "cool-team", "integration_key": "1234"},
                {"id": "", "team": "rad-team", "integration_key": "4321"},
            ]
        }
        responses.add(responses.GET, url="https://api.atlassian.com/v2/alerts?limit=1", status=401)

        with pytest.raises(ApiUnauthorized):
            installation.update_organization_config(data)

    @with_feature(
        {
            "organizations:integrations-enterprise-alert-rule": False,
            "organizations:integrations-enterprise-incident-management": False,
        }
    )
    def test_disallow_when_no_business_plan(self) -> None:
        resp = self.client.get(self.init_path)
        assert resp.status_code == 200
        assert (
            b"At least one feature from this list has to be enabled in order to setup the integration"
            in resp.content
        )
