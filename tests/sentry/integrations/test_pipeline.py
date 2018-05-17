from __future__ import absolute_import

from sentry.models import Integration, OrganizationIntegration
from sentry.testutils import IntegrationTestCase
from sentry.integrations.example import ExampleIntegrationProvider


class FinishPipelineTestCase(IntegrationTestCase):
    provider = ExampleIntegrationProvider

    def setUp(self):
        super(FinishPipelineTestCase, self).setUp()
        self.provider.build_integration = lambda self, data: data
        self.external_id = 'dummy_id-123'

    def test_with_data(self):
        self.pipeline.state.data = {'external_id': self.external_id}
        resp = self.pipeline.finish_pipeline()

        self.assertDialogSuccess(resp)

        integration = Integration.objects.get(
            provider=self.provider.key,
            external_id=self.external_id,
        )
        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization.id,
            integration_id=integration.id,
        )

    def test_with_pre_existing_ref(self):
        old_integration = Integration.objects.create(
            provider=self.provider.key,
            external_id=self.external_id,
            name='Tester',
        )
        self.pipeline.state.data = {self.pipeline.PREEXISTING_INTEGRATION: self.external_id}
        resp = self.pipeline.finish_pipeline()

        self.assertDialogSuccess(resp)
        integration = Integration.objects.get(
            provider=self.provider.key,
            external_id=self.external_id,
        )
        assert integration == old_integration
        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization.id,
            integration_id=integration.id,
        ).exists()
