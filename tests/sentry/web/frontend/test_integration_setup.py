from __future__ import absolute_import

from sentry.integrations.example import ExampleIntegration, ExampleSetupView
from sentry.models import Integration, OrganizationIntegration
from sentry.testutils import IntegrationTestCase


class ExampleIntegrationTest(IntegrationTestCase):
    provider = ExampleIntegration

    def test_basic_flow(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert ExampleSetupView.TEMPLATE in resp.content.decode('utf-8')

        resp = self.client.post(self.path, {'name': 'test'})
        assert resp.status_code == 200
        self.assertDialogSuccess(resp)

        integration = Integration.objects.get(provider=self.provider.key)
        assert integration.external_id == 'test'
        assert integration.name == 'test'
        assert integration.metadata == {}
        assert OrganizationIntegration.objects.filter(
            integration=integration,
            organization=self.organization,
        ).exists()
