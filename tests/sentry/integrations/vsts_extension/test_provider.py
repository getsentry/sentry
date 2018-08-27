from __future__ import absolute_import

from mock import patch

from sentry.integrations.vsts import VstsIntegrationProvider
from sentry.integrations.vsts_extension import (
    VstsExtensionIntegrationProvider,
    VstsExtensionFinishedView,
)
from sentry.testutils import TestCase


class VstsExtensionIntegrationProviderTest(TestCase):
    def setUp(self):
        self.provider = VstsExtensionIntegrationProvider()

    def test_get_pipeline_views(self):
        # Should be same as the VSTS integration, but with a different last
        # step.
        views = self.provider.get_pipeline_views()
        vsts_views = VstsIntegrationProvider().get_pipeline_views()

        assert isinstance(views[0], type(vsts_views[0]))
        assert isinstance(views[-1], VstsExtensionFinishedView)

    @patch('sentry.integrations.vsts.integration.get_user_info')
    @patch('sentry.integrations.vsts.integration.VstsIntegrationProvider.create_subscription')
    def test_build_integration(self, create_sub, get_user_info):
        get_user_info.return_value = {'id': '987'}
        create_sub.return_value = (1, 'sharedsecret')

        integration = self.provider.build_integration({
            'vsts': {
                'AccountId': '123',
                'AccountName': 'test',
            },
            'identity': {
                'data': {
                    'access_token': '123',
                    'expires_in': '3600',
                    'refresh_token': '321',
                },
            },
        })

        assert integration['external_id'] == '123'
        assert integration['name'] == 'test'
