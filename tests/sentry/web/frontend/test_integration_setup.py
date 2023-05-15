from sentry.integrations.example import ExampleIntegrationProvider, ExampleSetupView
from sentry.models import Integration, OrganizationIntegration
from sentry.testutils import IntegrationTestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class ExampleIntegrationTest(IntegrationTestCase):
    provider = ExampleIntegrationProvider

    def test_basic_flow(self):
        resp = self.client.get(self.init_path)
        assert resp.status_code == 200
        assert ExampleSetupView.TEMPLATE in resp.content.decode("utf-8")

        resp = self.client.post(self.setup_path, {"name": "test"})
        assert resp.status_code == 200
        self.assertDialogSuccess(resp)

        integration = Integration.objects.get(provider=self.provider.key)
        assert integration.external_id == "test"
        assert integration.name == "test"
        assert integration.metadata == {}
        assert OrganizationIntegration.objects.filter(
            integration=integration, organization_id=self.organization.id
        ).exists()
