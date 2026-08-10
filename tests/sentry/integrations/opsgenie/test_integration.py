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

    def _get_pipeline_url(self) -> str:
        return reverse(
            self.endpoint,
            args=[self.organization.slug, IntegrationPipeline.pipeline_name],
        )

    def _initialize_pipeline(self) -> Any:
        return self.client.post(
            self._get_pipeline_url(),
            data={"action": "initialize", "provider": "opsgenie"},
            format="json",
        )

    def _advance_step(self, data: dict[str, Any]) -> Any:
        return self.client.post(self._get_pipeline_url(), data=data, format="json")

    def _install(
        self,
        *,
        provider: str = "cool-name",
        base_url: str = "https://api.opsgenie.com/",
        api_key: str | None = "123-key",
    ) -> Any:
        self._initialize_pipeline()
        data = {"baseUrl": base_url, "provider": provider}
        if api_key is not None:
            data["apiKey"] = api_key
        return self._advance_step(data)

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
        resp = self._install()
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
        assert org_integration.config["team_table"] == [
            {
                "id": f"{org_integration.id}-my-first-key",
                "team": "my-first-key",
                "integration_key": "123-key",
            }
        ]

    @with_feature(
        {
            "organizations:integrations-enterprise-alert-rule": True,
            "organizations:integrations-enterprise-incident-management": True,
        }
    )
    def test_full_pipeline_flow_no_key(self) -> None:
        resp = self._install(api_key=None)
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"

        integration = Integration.objects.get(provider="opsgenie")
        assert integration.external_id == "cool-name"
        assert integration.metadata == {
            "base_url": "https://api.opsgenie.com/",
            "domain_name": "cool-name.app.opsgenie.com",
        }
        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id,
            integration=integration,
        )
        assert org_integration.config["team_table"] == []

    @with_feature(
        {
            "organizations:integrations-enterprise-alert-rule": True,
            "organizations:integrations-enterprise-incident-management": True,
        }
    )
    def test_new_organization_joins_existing_integration(self) -> None:
        self._install(api_key="key-a")
        integration = Integration.objects.get(provider="opsgenie")
        original_name = integration.name
        original_metadata = integration.metadata.copy()
        org_integration_a = OrganizationIntegration.objects.get(
            organization_id=self.organization.id,
            integration=integration,
        )

        organization_b = self.create_organization(owner=self.user)
        self.organization = organization_b
        resp = self._install(
            base_url="https://api.eu.opsgenie.com/",
            api_key="key-b",
        )

        assert resp.status_code == 200
        assert Integration.objects.get(provider="opsgenie") == integration
        integration.refresh_from_db()
        assert integration.name == original_name
        assert integration.metadata == original_metadata
        org_integration_a.refresh_from_db()
        assert org_integration_a.config["team_table"][0]["integration_key"] == "key-a"
        org_integration_b = OrganizationIntegration.objects.get(
            organization_id=organization_b.id,
            integration=integration,
        )
        assert org_integration_b.config["team_table"] == [
            {
                "id": f"{org_integration_b.id}-my-first-key",
                "team": "my-first-key",
                "integration_key": "key-b",
            }
        ]

    @with_feature(
        {
            "organizations:integrations-enterprise-alert-rule": True,
            "organizations:integrations-enterprise-incident-management": True,
        }
    )
    def test_existing_shared_integration_gains_another_organization(self) -> None:
        self._install(api_key="key-a")
        integration = Integration.objects.get(provider="opsgenie")
        organization_b = self.create_organization(owner=self.user)
        org_integration_b = integration.add_organization(organization_b, self.user)
        assert org_integration_b is not None
        org_integration_b.update(
            config={
                "team_table": [
                    {"id": "existing-b", "team": "existing-b", "integration_key": "key-b"}
                ]
            }
        )
        original_metadata = integration.metadata.copy()

        organization_c = self.create_organization(owner=self.user)
        self.organization = organization_c
        resp = self._install(
            base_url="https://api.eu.opsgenie.com/",
            api_key="key-c",
        )

        assert resp.status_code == 200
        assert OrganizationIntegration.objects.filter(integration=integration).count() == 3
        integration.refresh_from_db()
        assert integration.metadata == original_metadata
        org_integration_b.refresh_from_db()
        assert org_integration_b.config["team_table"] == [
            {"id": "existing-b", "team": "existing-b", "integration_key": "key-b"}
        ]
        org_integration_c = OrganizationIntegration.objects.get(
            organization_id=organization_c.id,
            integration=integration,
        )
        assert org_integration_c.config["team_table"][0]["integration_key"] == "key-c"

    @with_feature(
        {
            "organizations:integrations-enterprise-alert-rule": True,
            "organizations:integrations-enterprise-incident-management": True,
        }
    )
    def test_same_organization_reinstall(self) -> None:
        self._install(api_key="old-key")
        integration = Integration.objects.get(provider="opsgenie")
        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id,
            integration=integration,
        )
        original_metadata = integration.metadata.copy()

        resp = self._install(
            base_url="https://api.eu.opsgenie.com/",
            api_key="new-key",
        )

        assert resp.status_code == 200
        assert Integration.objects.get(provider="opsgenie") == integration
        integration.refresh_from_db()
        assert integration.metadata == original_metadata
        assert (
            OrganizationIntegration.objects.get(
                organization_id=self.organization.id,
                integration=integration,
            ).id
            == org_integration.id
        )
        org_integration.refresh_from_db()
        assert org_integration.config["team_table"][0]["integration_key"] == "new-key"

    @with_feature(
        {
            "organizations:integrations-enterprise-alert-rule": True,
            "organizations:integrations-enterprise-incident-management": True,
        }
    )
    def test_legacy_global_key_is_not_copied(self) -> None:
        integration = self.create_provider_integration(
            provider="opsgenie",
            name="cool-name",
            external_id="cool-name",
            metadata={
                "api_key": "legacy-key",
                "base_url": "https://api.opsgenie.com/",
                "domain_name": "cool-name.app.opsgenie.com",
            },
        )
        integration.add_organization(self.organization, self.user)
        original_metadata = integration.metadata.copy()

        organization_b = self.create_organization(owner=self.user)
        self.organization = organization_b
        resp = self._install(api_key="key-b")

        assert resp.status_code == 200
        integration.refresh_from_db()
        assert integration.metadata == original_metadata
        org_integration_b = OrganizationIntegration.objects.get(
            organization_id=organization_b.id,
            integration=integration,
        )
        assert org_integration_b.config["team_table"][0]["integration_key"] == "key-b"

    @with_feature(
        {
            "organizations:integrations-enterprise-alert-rule": True,
            "organizations:integrations-enterprise-incident-management": True,
        }
    )
    def test_existing_integration_without_key(self) -> None:
        self._install(api_key="key-a")
        integration = Integration.objects.get(provider="opsgenie")
        original_metadata = integration.metadata.copy()

        organization_b = self.create_organization(owner=self.user)
        self.organization = organization_b
        resp = self._install(api_key=None)

        assert resp.status_code == 200
        integration.refresh_from_db()
        assert integration.metadata == original_metadata
        org_integration_b = OrganizationIntegration.objects.get(
            organization_id=organization_b.id,
            integration=integration,
        )
        assert org_integration_b.config["team_table"] == []
