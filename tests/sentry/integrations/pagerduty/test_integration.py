from __future__ import annotations

from typing import Any

import orjson
import pytest
from django.urls import reverse

from sentry import options
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pagerduty.utils import add_service, get_services
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class PagerDutyIntegrationConfigTest(TestCase):
    """Tests for PagerDuty integration business logic (config updates, service management)."""

    def setUp(self) -> None:
        super().setUp()
        self.integration, self.org_integration = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider="pagerduty",
            name="Test App",
            external_id="test-app",
            metadata={
                "services": [
                    {
                        "integration_key": "key1",
                        "name": "Super Cool Service",
                        "id": "PD12345",
                        "type": "service",
                    }
                ],
                "domain_name": "test-app",
            },
        )
        self.service = add_service(
            self.org_integration,
            service_name="Super Cool Service",
            integration_key="key1",
        )

    def test_update_organization_config(self) -> None:
        service_id = self.service["id"]
        config_data = {
            "service_table": [
                {"service": "Mleep", "integration_key": "xxxxxxxxxxxxxxxx", "id": service_id},
                {"service": "new_service", "integration_key": "new_key", "id": None},
            ]
        }
        self.integration.get_installation(self.organization.id).update_organization_config(
            config_data
        )
        self.org_integration.refresh_from_db()
        services = get_services(self.org_integration)

        del services[1]["id"]  # type: ignore[misc]

        assert services == [
            dict(
                id=service_id,
                integration_key="xxxxxxxxxxxxxxxx",
                integration_id=self.org_integration.integration_id,
                service_name="Mleep",
            ),
            dict(
                integration_key="new_key",
                integration_id=self.org_integration.integration_id,
                service_name="new_service",
            ),
        ]

    def test_delete_pagerduty_service(self) -> None:
        services = get_services(self.org_integration)
        assert len(services) == 1
        service_id = services[0]["id"]
        config_data = {
            "service_table": [{"service": "new_service", "integration_key": "new_key", "id": None}]
        }
        self.integration.get_installation(self.organization.id).update_organization_config(
            config_data
        )

        self.org_integration.refresh_from_db()
        services = get_services(self.org_integration)
        assert len(services) == 1
        assert services[0]["id"] != service_id

    def test_no_name(self) -> None:
        service_id = self.service["id"]
        config_data = {
            "service_table": [{"service": "new_service", "integration_key": "", "id": service_id}]
        }
        with pytest.raises(IntegrationError) as error:
            self.integration.get_installation(self.organization.id).update_organization_config(
                config_data
            )
        assert str(error.value) == "Name and key are required"

    def test_get_config_data(self) -> None:
        service = get_services(self.org_integration)[0]
        config = self.integration.get_installation(self.organization.id).get_config_data()
        assert config == {
            "service_table": [
                {
                    "id": service["id"],
                    "service": service["service_name"],
                    "integration_key": service["integration_key"],
                }
            ]
        }


@control_silo_test
class PagerDutyApiPipelineTest(APITestCase):
    endpoint = "sentry-api-0-organization-pipeline"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.app_id = "app_1"
        options.set("pagerduty.app-id", self.app_id)

    def _get_pipeline_url(self) -> str:
        return reverse(
            self.endpoint,
            args=[self.organization.slug, IntegrationPipeline.pipeline_name],
        )

    def _initialize_pipeline(self) -> Any:
        return self.client.post(
            self._get_pipeline_url(),
            data={"action": "initialize", "provider": "pagerduty"},
            format="json",
        )

    def _advance_step(self, data: dict[str, Any]) -> Any:
        return self.client.post(self._get_pipeline_url(), data=data, format="json")

    def _make_config(self, **overrides: Any) -> str:
        config = {
            "integration_keys": [
                {
                    "integration_key": "key1",
                    "name": "Super Cool Service",
                    "id": "PD12345",
                    "type": "service",
                },
            ],
            "account": {"subdomain": "test-app", "name": "Test App"},
        }
        config.update(overrides)
        return orjson.dumps(config).decode()

    def test_initialize_pipeline(self) -> None:
        resp = self._initialize_pipeline()
        assert resp.status_code == 200
        assert resp.data["step"] == "installation_redirect"
        assert resp.data["stepIndex"] == 0
        assert resp.data["totalSteps"] == 1
        assert resp.data["provider"] == "pagerduty"
        assert "installUrl" in resp.data["data"]
        install_url = resp.data["data"]["installUrl"]
        assert "pagerduty.com/install/integration" in install_url
        assert f"app_id={self.app_id}" in install_url

    def test_missing_config(self) -> None:
        self._initialize_pipeline()
        resp = self._advance_step({})
        assert resp.status_code == 400

    def test_invalid_json_config(self) -> None:
        self._initialize_pipeline()
        resp = self._advance_step({"config": "not-valid-json"})
        assert resp.status_code == 400

    def test_full_pipeline_flow(self) -> None:
        resp = self._initialize_pipeline()
        assert resp.data["step"] == "installation_redirect"

        resp = self._advance_step({"config": self._make_config()})
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"
        assert "data" in resp.data

        integration = Integration.objects.get(provider="pagerduty")
        assert integration.external_id == "test-app"
        assert integration.name == "Test App"
        assert integration.metadata["services"] == [
            {
                "integration_key": "key1",
                "name": "Super Cool Service",
                "id": "PD12345",
                "type": "service",
            }
        ]

        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization.id,
            integration=integration,
        ).exists()
