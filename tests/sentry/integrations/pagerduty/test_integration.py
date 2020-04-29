from __future__ import absolute_import

import responses

import pytest
import six
from sentry import options
from sentry.utils import json

from six.moves.urllib.parse import urlencode, urlparse
from sentry.models import Integration, OrganizationIntegration, PagerDutyService
from sentry.testutils import IntegrationTestCase
from sentry.integrations.pagerduty.integration import PagerDutyIntegrationProvider
from sentry.shared_integrations.exceptions import IntegrationError


class PagerDutyIntegrationTest(IntegrationTestCase):
    provider = PagerDutyIntegrationProvider
    base_url = "https://app.pagerduty.com"

    def setUp(self):
        super(PagerDutyIntegrationTest, self).setUp()
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
            u"{}?{}".format(self.setup_path, urlencode({"config": json.dumps(config)}))
        )

        self.assertDialogSuccess(resp)
        return resp

    def assert_add_service_flow(self, integration):
        query_param = "?account=%s" % (integration.metadata["domain_name"])
        init_path_with_account = "%s%s" % (self.init_path, query_param)
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
            u"{}?{}".format(self.setup_path, urlencode({"config": json.dumps(config)}))
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
            integration=integration, organization=self.organization
        )
        assert oi.config == {}

    @responses.activate
    def test_add_services_flow(self):
        with self.tasks():
            self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)
        service = PagerDutyService.objects.get(
            organization_integration=OrganizationIntegration.objects.get(
                integration=integration, organization=self.organization
            )
        )

        url = "https://%s.pagerduty.com" % (integration.metadata["domain_name"])
        responses.add(
            responses.GET,
            url
            + "/install/integration?app_id=%sredirect_url=%s&version=1"
            % (self.app_id, self.setup_path),
        )

        with self.tasks():
            self.assert_add_service_flow(integration)

        assert PagerDutyService.objects.filter(id=service.id).exists()
        assert PagerDutyService.objects.filter(service_name="Additional Service").exists()

    @responses.activate
    def test_update_organization_config(self):
        with self.tasks():
            self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        service_id = PagerDutyService.objects.get(integration_key="key1").id
        config_data = {
            "service_table": [
                {"service": "Mleep", "integration_key": "xxxxxxxxxxxxxxxx", "id": None},
                {"service": "new_service", "integration_key": "new_key", "id": service_id},
            ]
        }
        integration.get_installation(self.organization).update_organization_config(config_data)
        assert len(PagerDutyService.objects.filter()) == 2
        service_row = PagerDutyService.objects.get(id=service_id)
        assert service_row.service_name == "new_service"
        assert service_row.integration_key == "new_key"

    @responses.activate
    def test_delete_pagerduty_service(self):
        with self.tasks():
            self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        service_id = PagerDutyService.objects.get(integration_key="key1").id
        config_data = {
            "service_table": [{"service": "new_service", "integration_key": "new_key", "id": None}]
        }
        integration.get_installation(self.organization).update_organization_config(config_data)
        assert len(PagerDutyService.objects.all()) == 1
        assert not PagerDutyService.objects.filter(id=service_id).exists()

    @responses.activate
    def test_no_name(self):
        with self.tasks():
            self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        service_id = PagerDutyService.objects.get(integration_key="key1").id
        config_data = {
            "service_table": [{"service": "new_service", "integration_key": "", "id": service_id}]
        }
        with pytest.raises(IntegrationError) as error:
            integration.get_installation(self.organization).update_organization_config(config_data)
        assert six.text_type(error.value) == "Name and key are required"

    @responses.activate
    def test_get_config_data(self):
        with self.tasks():
            self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)
        service = PagerDutyService.objects.get(
            organization_integration=OrganizationIntegration.objects.get(
                integration=integration, organization=self.organization
            )
        )
        config = integration.get_installation(self.organization).get_config_data()
        assert config == {
            "service_table": [
                {
                    "id": service.id,
                    "service": service.service_name,
                    "integration_key": service.integration_key,
                }
            ]
        }
