from urllib.parse import urlencode, urlparse

import pytest
import responses

from sentry import options
from sentry.integrations.pagerduty.integration import PagerDutyIntegrationProvider
from sentry.integrations.pagerduty.utils import get_services
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import json


@control_silo_test
class PagerDutyIntegrationTest(IntegrationTestCase):
    provider = PagerDutyIntegrationProvider
    base_url = "https://app.pagerduty.com"

    def setUp(self):
        super().setUp()
        self.app_id = "app_1"
        self.account_slug = "test-app"
        self._stub_pagerduty()

    def _stub_pagerduty(self):
        options.set("pagerduty.app-id", self.app_id)
        responses.reset()

        responses.add(
            responses.GET,
            self.base_url
            + "/install/integration?app_id=%sredirect_url=%s&version=1"
            % (self.app_id, self.setup_path),
        )

    def assert_setup_flow(self):
        resp = self.client.get(self.init_path)
        assert resp.status_code == 302
        redirect = urlparse(resp["Location"])
        assert redirect.scheme == "https"
        assert redirect.netloc == "app.pagerduty.com"
        assert redirect.path == "/install/integration"

        config = {
            "integration_keys": [
                {
                    "integration_key": "key1",
                    "name": "Super Cool Service",
                    "id": "PD12345",
                    "type": "service",
                },
                {
                    "integration_key": "key3",
                    "name": "B Team's Rules",
                    "id": "PDBCDEF",
                    "type": "team_rule_set",
                },
            ],
            "account": {"subdomain": "test-app", "name": "Test App"},
        }

        resp = self.client.get(
            "{}?{}".format(self.setup_path, urlencode({"config": json.dumps(config)}))
        )

        self.assertDialogSuccess(resp)
        return resp

    def assert_add_service_flow(self, integration):
        query_param = "?account=%s" % (integration.metadata["domain_name"])
        init_path_with_account = f"{self.init_path}{query_param}"
        resp = self.client.get(init_path_with_account)
        assert resp.status_code == 302
        redirect = urlparse(resp["Location"])
        assert redirect.scheme == "https"
        assert redirect.netloc == "%s.pagerduty.com" % integration.metadata["domain_name"]
        assert redirect.path == "/install/integration"

        config = {
            "integration_keys": [
                {
                    "integration_key": "additional-service",
                    "name": "Additional Service",
                    "id": "PD123467",
                    "type": "service",
                }
            ],
            "account": {"subdomain": "test-app", "name": "Test App"},
        }

        resp = self.client.get(
            "{}?{}".format(self.setup_path, urlencode({"config": json.dumps(config)}))
        )

        self.assertDialogSuccess(resp)
        return resp

    @responses.activate
    def test_basic_flow(self):
        with self.tasks():
            self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)

        assert integration.external_id == self.account_slug
        assert integration.name == "Test App"
        assert integration.metadata["services"] == [
            {
                "integration_key": "key1",
                "name": "Super Cool Service",
                "id": "PD12345",
                "type": "service",
            }
        ]
        oi = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )
        services = get_services(oi)
        assert services[0]["service_name"] == "Super Cool Service"

    @responses.activate
    def test_add_services_flow(self):
        with self.tasks():
            self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)
        oi = OrganizationIntegration.objects.get(
            integration_id=integration.id, organization_id=self.organization.id
        )
        service = get_services(oi)[0]

        url = "https://%s.pagerduty.com" % (integration.metadata["domain_name"])
        responses.add(
            responses.GET,
            url
            + "/install/integration?app_id=%sredirect_url=%s&version=1"
            % (self.app_id, self.setup_path),
        )

        with self.tasks():
            self.assert_add_service_flow(integration)

        oi.refresh_from_db()
        services = get_services(oi)
        assert services[1]["id"]
        del services[1]["id"]  # type: ignore
        assert services == [
            service,
            dict(
                integration_id=integration.id,
                integration_key="additional-service",
                service_name="Additional Service",
            ),
        ]

    @responses.activate
    def test_update_organization_config(self):
        with self.tasks():
            self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        oi = OrganizationIntegration.objects.get(
            integration_id=integration.id, organization_id=self.organization.id
        )
        service_id = get_services(oi)[0]["id"]
        config_data = {
            "service_table": [
                {"service": "Mleep", "integration_key": "xxxxxxxxxxxxxxxx", "id": service_id},
                {"service": "new_service", "integration_key": "new_key", "id": None},
            ]
        }
        integration.get_installation(self.organization.id).update_organization_config(config_data)
        oi.refresh_from_db()
        services = get_services(oi)

        del services[1]["id"]  # type: ignore

        assert services == [
            dict(
                id=service_id,
                integration_key="xxxxxxxxxxxxxxxx",
                integration_id=oi.integration_id,
                service_name="Mleep",
            ),
            dict(
                integration_key="new_key",
                integration_id=oi.integration_id,
                service_name="new_service",
            ),
        ]

    @responses.activate
    def test_delete_pagerduty_service(self):
        with self.tasks():
            self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        oi = OrganizationIntegration.objects.get(
            integration_id=integration.id, organization_id=self.organization.id
        )
        services = get_services(oi)
        assert len(services) == 1
        service_id = services[0]["id"]
        config_data = {
            "service_table": [{"service": "new_service", "integration_key": "new_key", "id": None}]
        }
        integration.get_installation(self.organization.id).update_organization_config(config_data)

        oi.refresh_from_db()
        services = get_services(oi)
        assert len(services) == 1
        assert services[0]["id"] != service_id

    @responses.activate
    def test_no_name(self):
        with self.tasks():
            self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        oi = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )
        service = get_services(oi)[0]
        service_id = service["id"]
        config_data = {
            "service_table": [{"service": "new_service", "integration_key": "", "id": service_id}]
        }
        with pytest.raises(IntegrationError) as error:
            integration.get_installation(self.organization.id).update_organization_config(
                config_data
            )
        assert str(error.value) == "Name and key are required"

    @responses.activate
    def test_get_config_data(self):
        with self.tasks():
            self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)
        oi = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )
        service = get_services(oi)[0]
        config = integration.get_installation(self.organization.id).get_config_data()
        assert config == {
            "service_table": [
                {
                    "id": service["id"],
                    "service": service["service_name"],
                    "integration_key": service["integration_key"],
                }
            ]
        }
