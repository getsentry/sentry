from __future__ import absolute_import

import responses

from sentry import options
from sentry.utils import json

from six.moves.urllib.parse import urlencode, urlparse
from sentry.models import Integration, OrganizationIntegration
from sentry.testutils import IntegrationTestCase
from sentry.integrations.pagerduty.integration import PagerDutyIntegrationProvider


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
