from __future__ import annotations

from typing import Any

import pytest
import responses
from django.urls import reverse
from rest_framework.serializers import ValidationError

from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.shared_integrations.exceptions import ApiRateLimitedError, ApiUnauthorized
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import control_silo_test

EXTERNAL_ID = "test-app"
METADATA = {
    "api_key": "1234-ABCD",
    "base_url": "https://api.opsgenie.com/",
    "domain_name": "test-app.app.opsgenie.com",
}


@control_silo_test
class OpsgenieUpdateConfigTest(TestCase):
    provider = "opsgenie"

    @responses.activate
    def test_update_config_valid(self) -> None:
        integration = self.create_provider_integration(
            provider="opsgenie", name="test-app", external_id=EXTERNAL_ID, metadata=METADATA
        )

        integration.add_organization(self.organization, self.user)
        installation = integration.get_installation(self.organization.id)

        integration = Integration.objects.get(provider=self.provider)
        org_integration = OrganizationIntegration.objects.get(integration_id=integration.id)

        responses.add(
            responses.GET, url="https://api.opsgenie.com/v2/alerts?limit=1", status=200, json={}
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
            provider="opsgenie", name="test-app", external_id=EXTERNAL_ID, metadata=METADATA
        )

        integration.add_organization(self.organization, self.user)
        installation = integration.get_installation(self.organization.id)

        org_integration = OrganizationIntegration.objects.get(integration_id=integration.id)
        team_id = str(org_integration.id) + "-" + "cool-team"

        responses.add(
            responses.GET, url="https://api.opsgenie.com/v2/alerts?limit=1", status=200, json={}
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
            provider="opsgenie", name="test-app", external_id=EXTERNAL_ID, metadata=METADATA
        )
        integration.add_organization(self.organization, self.user)
        installation = integration.get_installation(self.organization.id)

        data = {
            "team_table": [
                {"id": "", "team": "rad-team", "integration_key": "4321"},
                {"id": "cool-team", "team": "cool-team", "integration_key": "1234"},
            ]
        }
        responses.add(responses.GET, url="https://api.opsgenie.com/v2/alerts?limit=1", status=429)

        with pytest.raises(ApiRateLimitedError):
            installation.update_organization_config(data)

    @responses.activate
    def test_update_config_invalid_integration_key(self) -> None:
        integration = self.create_provider_integration(
            provider="opsgenie", name="test-app", external_id=EXTERNAL_ID, metadata=METADATA
        )
        integration.add_organization(self.organization, self.user)
        installation = integration.get_installation(self.organization.id)

        data = {
            "team_table": [
                {"id": "cool-team", "team": "cool-team", "integration_key": "1234"},
                {"id": "", "team": "rad-team", "integration_key": "4321"},
            ]
        }
        responses.add(responses.GET, url="https://api.opsgenie.com/v2/alerts?limit=1", status=401)

        with pytest.raises(ApiUnauthorized):
            installation.update_organization_config(data)


@control_silo_test
class OpsgenieApiPipelineTest(APITestCase):
    endpoint = "sentry-api-0-organization-pipeline"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def _get_pipeline_url(self, organization=None) -> str:
        organization = organization or self.organization
        return reverse(
            self.endpoint,
            args=[organization.slug, IntegrationPipeline.pipeline_name],
        )

    def _initialize_pipeline(self, organization=None) -> Any:
        return self.client.post(
            self._get_pipeline_url(organization),
            data={"action": "initialize", "provider": "opsgenie"},
            format="json",
        )

    def _advance_step(self, data: dict[str, Any], organization=None) -> Any:
        return self.client.post(self._get_pipeline_url(organization), data=data, format="json")

    def _install(
        self,
        organization=None,
        *,
        base_url: str = "https://api.opsgenie.com/",
        provider: str = "cool-name",
        api_key: str = "123-key",
    ) -> Any:
        self._initialize_pipeline(organization)
        return self._advance_step(
            {"baseUrl": base_url, "provider": provider, "apiKey": api_key}, organization
        )

    @with_feature(
        {
            "organizations:integrations-enterprise-alert-rule": True,
            "organizations:integrations-enterprise-incident-management": True,
        }
    )
    def test_initialize_pipeline(self) -> None:
        resp = self._initialize_pipeline()
        assert resp.status_code == 200
        assert resp.data["step"] == "installation_config"
        assert resp.data["stepIndex"] == 0
        assert resp.data["totalSteps"] == 1
        assert resp.data["provider"] == "opsgenie"
        assert "baseUrlChoices" in resp.data["data"]

    @with_feature(
        {
            "organizations:integrations-enterprise-alert-rule": True,
            "organizations:integrations-enterprise-incident-management": True,
        }
    )
    def test_invalid_base_url(self) -> None:
        self._initialize_pipeline()
        resp = self._advance_step(
            {
                "baseUrl": "https://evil.example.com/",
                "provider": "test-app",
            }
        )
        assert resp.status_code == 400

    @with_feature(
        {
            "organizations:integrations-enterprise-alert-rule": True,
            "organizations:integrations-enterprise-incident-management": True,
        }
    )
    def test_full_pipeline_flow(self) -> None:
        resp = self._initialize_pipeline()
        assert resp.data["step"] == "installation_config"

        resp = self._advance_step(
            {
                "baseUrl": "https://api.opsgenie.com/",
                "provider": "cool-name",
                "apiKey": "123-key",
            }
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"

        integration = Integration.objects.get(provider="opsgenie")
        assert integration.external_id == "cool-name"
        assert integration.name == "cool-name"
        assert integration.metadata == {
            "base_url": "https://api.opsgenie.com/",
            "domain_name": "cool-name.app.opsgenie.com",
        }

        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id,
            integration=integration,
        )
        assert org_integration.config == {
            "team_table": [
                {
                    "team": "my-first-key",
                    "id": f"{org_integration.id}-my-first-key",
                    "integration_key": "123-key",
                }
            ]
        }

    @with_feature(
        {
            "organizations:integrations-enterprise-alert-rule": True,
            "organizations:integrations-enterprise-incident-management": True,
        }
    )
    def test_full_pipeline_flow_no_key(self) -> None:
        self._initialize_pipeline()
        resp = self._advance_step(
            {
                "baseUrl": "https://api.opsgenie.com/",
                "provider": "cool-name",
            }
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"

        integration = Integration.objects.get(provider="opsgenie")
        assert integration.external_id == "cool-name"
        assert integration.metadata == {
            "base_url": "https://api.opsgenie.com/",
            "domain_name": "cool-name.app.opsgenie.com",
        }
        assert OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration=integration
        ).config == {"team_table": []}

    @with_feature(
        {
            "organizations:integrations-enterprise-alert-rule": True,
            "organizations:integrations-enterprise-incident-management": True,
        }
    )
    def test_cross_organization_install_preserves_global_data_and_isolates_keys(self) -> None:
        self._install()
        integration = Integration.objects.get(provider="opsgenie", external_id="cool-name")

        other_organization = self.create_organization(owner=self.user)
        resp = self._install(
            other_organization,
            base_url="https://api.eu.opsgenie.com/",
            api_key="other-key",
        )
        assert resp.status_code == 200

        integration.refresh_from_db()
        assert integration.name == "cool-name"
        assert integration.metadata == {
            "base_url": "https://api.opsgenie.com/",
            "domain_name": "cool-name.app.opsgenie.com",
        }
        assert Integration.objects.filter(provider="opsgenie", external_id="cool-name").count() == 1

        organization_integration = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )
        other_organization_integration = OrganizationIntegration.objects.get(
            integration=integration, organization_id=other_organization.id
        )
        assert organization_integration.config["team_table"] == [
            {
                "team": "my-first-key",
                "id": f"{organization_integration.id}-my-first-key",
                "integration_key": "123-key",
            }
        ]
        assert other_organization_integration.config["team_table"] == [
            {
                "team": "my-first-key",
                "id": f"{other_organization_integration.id}-my-first-key",
                "integration_key": "other-key",
            }
        ]

    @with_feature(
        {
            "organizations:integrations-enterprise-alert-rule": True,
            "organizations:integrations-enterprise-incident-management": True,
        }
    )
    def test_existing_legacy_key_is_not_copied_to_new_organization(self) -> None:
        integration = self.create_provider_integration(
            provider="opsgenie",
            external_id="cool-name",
            name="Existing Name",
            metadata={
                "api_key": "legacy-key",
                "base_url": "https://api.opsgenie.com/",
                "domain_name": "cool-name.app.opsgenie.com",
            },
        )
        other_organization = self.create_organization(owner=self.user)

        resp = self._install(other_organization, api_key="")
        assert resp.status_code == 200

        integration.refresh_from_db()
        assert integration.name == "Existing Name"
        assert integration.metadata["api_key"] == "legacy-key"
        assert OrganizationIntegration.objects.get(
            integration=integration, organization_id=other_organization.id
        ).config == {"team_table": []}

    @with_feature(
        {
            "organizations:integrations-enterprise-alert-rule": True,
            "organizations:integrations-enterprise-incident-management": True,
        }
    )
    def test_same_organization_reinstall_preserves_global_data_and_replaces_key(self) -> None:
        self._install()
        integration = Integration.objects.get(provider="opsgenie", external_id="cool-name")
        org_integration = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )

        self._install(base_url="https://api.eu.opsgenie.com/", api_key="replacement-key")

        integration.refresh_from_db()
        org_integration.refresh_from_db()
        assert integration.metadata == {
            "base_url": "https://api.opsgenie.com/",
            "domain_name": "cool-name.app.opsgenie.com",
        }
        assert (
            OrganizationIntegration.objects.get(
                integration=integration, organization_id=self.organization.id
            ).id
            == org_integration.id
        )
        assert org_integration.config["team_table"] == [
            {
                "team": "my-first-key",
                "id": f"{org_integration.id}-my-first-key",
                "integration_key": "replacement-key",
            }
        ]
