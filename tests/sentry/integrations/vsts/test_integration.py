from __future__ import absolute_import

import responses
import six

from six.moves.urllib.parse import parse_qs, urlencode, urlparse

from sentry.integrations.vsts import VSTSIntegration
from sentry.testutils import IntegrationTestCase


class VSTSIntegrationTest(IntegrationTestCase):
    provider = VSTSIntegration
    instance = 'example.visualstudio.com'
    default_project = 'MyFirstProject'

    def test_path(self):
        resp = self.client.get(self.init_path)
        assert resp.status_code == 302
        redirect = urlparse(resp['Location'])
        assert redirect.scheme == 'https'
        assert redirect.netloc == 'app.vssps.visualstudio.com'
        assert redirect.path == '/oauth2/authorize'
        params = parse_qs(redirect.query)
        assert params['scope'] == [' '.join(self.provider.identity_oauth_scopes)]
        assert params['state']
        assert params['redirect_uri'] == ['http://testserver/extensions/vsts/setup/']
        assert params['response_type'] == ['code']
        assert params['client_id'] == ['vsts-client-id']

    @responses.activate
    def test_oath(self):
        resp = self.client.get(self.init_path)
        assert resp.status_code == 302
        redirect = urlparse(resp['Location'])
        params = parse_qs(redirect.query)
        authorize_params = {k: v[0] for k, v in six.iteritems(params)}

        responses.add(
            responses.POST, 'https://app.vssps.visualstudio.com/oauth2/token',
            json={
                'access_token': 'xxxxxxxxx',
                'token_type': 'jwt-bearer',
                'expires_in': '3599',
                'refresh_token': 'zzzzzzzzzz',
            },
        )

        resp = self.client.get('{}?{}'.format(
            self.setup_path,
            urlencode({
                'code': 'oauth-code',
                'state': authorize_params['state'],
            })
        ))

        mock_request = responses.calls[0].request
        req_params = parse_qs(mock_request.body)
        assert req_params['grant_type'] == ['urn:ietf:params:oauth:grant-type:jwt-bearer']
        assert req_params['assertion'] == ['oauth-code']
        assert req_params['redirect_uri'] == ['http://testserver/extensions/vsts/setup/']
        assert req_params['client_assertion_type'] == [
            'urn:ietf:params:oauth:client-assertion-type:jwt-bearer']
        assert req_params['client_assertion'] == ['vsts-client-secret']

        assert resp.status_code == 200

    @responses.activate
    def test_build_integration(self):
        first_project_id = 'xxxxxxx-xxxx-xxxx-xxxxxxxxxxxxxxxx'
        responses.add(
            responses.GET,
            'https://{}/DefaultCollection/_apis/projects'.format(self.instance),
            json={
                'value': [
                    {
                        'id': first_project_id,
                        'name': self.default_project,
                        'url': 'https://myfirstproject.visualstudio.com/DefaultCollection/_apis/projects/xxxxxxx-xxxx-xxxx-xxxxxxxxxxxxxxxx',
                        'description': 'My First Project!',
                    },
                    {
                        'id': 'xxxxxxx-xxxx-xxxx-xxxxxxxxxxxxxxxz',
                        'name': 'MySecondProject',
                        'url': 'https://mysecondproject.visualstudio.com/DefaultCollection/_apis/projects/xxxxxxx-xxxx-xxxx-xxxxxxxxxxxxxxxz',
                        'description': 'Not My First Project!',
                    }
                ],
                'count': 2,
            },
        )

        integration = VSTSIntegration()
        state = {
            'identity': {
                'data': {'access_token': 'xxxxxxxxxxxxxxx', },
                'instance': self.instance,
                'default_project': self.default_project,
            }
        }
        integration_dict = integration.build_integration(state)
        assert integration_dict['name'] == self.default_project
        assert integration_dict['external_id'] == first_project_id
        assert integration_dict['metadata']['access_token'] == state['identity']['data']['access_token']
        assert set(integration_dict['metadata']['scopes']) == set(integration.identity_oauth_scopes)
        assert integration_dict['metadata']['domain_name'] == self.instance

        assert integration_dict['user_identity'] == {
            'type': 'vsts',
            'external_id': self.instance,
            'scopes': [],
            'data': {},
        }
