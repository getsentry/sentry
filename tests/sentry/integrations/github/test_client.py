from __future__ import absolute_import

import responses
import mock

from sentry.testutils import TestCase
from sentry.models import Integration


class GitHubAppsClientTest(TestCase):

    @mock.patch('sentry.integrations.github.client.get_jwt', return_value='jwt_token_1')
    @responses.activate
    def test_save_token(self, get_jwt):

        integration = Integration.objects.create(
            provider='github',
            name='Github Test Org',
            external_id='1',
            metadata={
                'access_token': None,
                'expires_at': None,
            }
        )

        install = integration.get_installation()
        client = install.get_client()

        responses.add(
            method=responses.POST,
            url='https://api.github.com/installations/1/access_tokens',
            body='{"token": "12345token", "expires_at": "2030-01-01T00:00:00Z"}',
            status=200,
            content_type='application/json',
        )

        token = client.get_token()
        assert token == '12345token'
        assert len(responses.calls) == 1

        # Second get_token doesn't have to make an API call
        token = client.get_token()
        assert token == '12345token'
        assert len(responses.calls) == 1
