from __future__ import absolute_import

from sentry.models import Integration, OrganizationIntegration
from sentry.testutils import IntegrationTestCase
from sentry.integrations.example import ExampleIntegrationProvider


class FinishPipelineTestCase(IntegrationTestCase):
    provider = ExampleIntegrationProvider

    def setUp(self):
        super(FinishPipelineTestCase, self).setUp()
        self.original_build_integration = self.provider.build_integration
        self.provider.build_integration = lambda self, data: data
        self.external_id = 'dummy_id-123'

    def tearDown(self):
        self.provider.build_integration = self.original_build_integration

    def test_with_data(self):
        data = {
            'external_id': self.external_id,
            'name': 'Name',
            'metadata': {'url': 'https://example.com'},
        }
        self.pipeline.state.data = data
        resp = self.pipeline.finish_pipeline()

        self.assertDialogSuccess(resp)

        integration = Integration.objects.get(
            provider=self.provider.key,
            external_id=self.external_id,
        )
        assert integration.name == data['name']
        assert integration.metadata == data['metadata']
        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization.id,
            integration_id=integration.id,
        ).exists()

    def test_with_expect_exists(self):
        old_integration = Integration.objects.create(
            provider=self.provider.key,
            external_id=self.external_id,
            name='Tester',
        )
        self.pipeline.state.data = {
            'expect_exists': True,
            'external_id': self.external_id,
        }
        resp = self.pipeline.finish_pipeline()

        self.assertDialogSuccess(resp)
        integration = Integration.objects.get(
            provider=self.provider.key,
            external_id=self.external_id,
        )
        assert integration.name == old_integration.name
        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization.id,
            integration_id=integration.id,
        ).exists()

    def test_expect_exists_does_not_update(self):
        old_integration = Integration.objects.create(
            provider=self.provider.key,
            external_id=self.external_id,
            name='Tester',
            metadata={'url': 'https://example.com'},
        )
        self.pipeline.state.data = {
            'expect_exists': True,
            'external_id': self.external_id,
            'name': 'Should Not Update',
            'metadata': {'url': 'https://wrong.com'},
        }
        resp = self.pipeline.finish_pipeline()

        self.assertDialogSuccess(resp)
        integration = Integration.objects.get(
            provider=self.provider.key,
            external_id=self.external_id,
        )
        assert integration.name == old_integration.name
        assert integration.metadata == old_integration.metadata
        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization.id,
            integration_id=integration.id,
        ).exists()
