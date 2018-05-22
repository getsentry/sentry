from __future__ import absolute_import
from sentry.testutils import IntegrationTestCase
from sentry.models import Integration
from sentry.integrations.bitbucket.integration import BitbucketIntegrationProvider


class BitbucketIntegrationProviderTestCase(IntegrationTestCase):
    provider = BitbucketIntegrationProvider

    def test_finish_integration(self):
        client_key = 'client:12345'
        uuid = '1234567890'
        Integration.objects.create(
            provider=self.provider.key,
            name='tester',
            metadata={'uuid': uuid},
            external_id=client_key,
        )

        self.pipeline.state.data = {'identity': {'bitbucket_client_key': client_key}}
        self.pipeline.finish_pipeline()
        assert Integration.objects.filter(
            provider=self.provider.key,
            external_id=uuid,
        ).exists()
        assert not Integration.objects.filter(
            provider=self.provider.key,
            external_id=client_key,
        ).exists()
