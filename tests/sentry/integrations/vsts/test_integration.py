from __future__ import absolute_import

import responses
import six

from six.moves.urllib.parse import parse_qs, urlencode, urlparse

from sentry.integrations.vsts import VSTSIntegration
from sentry.models import Identity, IdentityProvider, IdentityStatus, Integration, OrganizationIntegration
from sentry.testutils import IntegrationTestCase


class VSTSIntegrationTest(IntegrationTestCase):
    provider = VSTSIntegration
    instance = 'example.visualstudio.com'
    default_project = 'MyFirstProject'

    @responses.activate
    def test_path(self):
        resp = self.client.get(self.path)
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

    def test_oath(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 302
        redirect = urlparse(resp['Location'])
        params = parse_qs(redirect.query)
        authorize_params = {k: v[0] for k, v in six.iteritems(params)}

        responses.add(
            responses.GET, 'https://app.vssps.visualstudio.com/oauth2/token',
            json={
                'access_token': 'xxxxxxxxx',
                'token_type': 'jwt-bearer',
                'expires_in': '3599',
                'refresh_token': 'zzzzzzzzzz',
            },
        )

        resp = self.client.get('{}?{}'.format(
            self.path,
            urlencode({
                'code': 'oauth-code',
                'state': authorize_params['state'],
            })
        ))

        mock_request = responses.calls[0].request
        req_params = parse_qs(mock_request.body)
        assert req_params['grant_type'] == ['authorization_code']
        assert req_params['code'] == ['oauth-code']
        assert req_params['redirect_uri'] == ['http://testserver/extensions/vsts/setup/']
        assert req_params['client_id'] == ['vsts-client-id']
        assert req_params['client_secret'] == ['vsts-client-secret']

        assert resp.status_code == 200
        self.assertDialogSuccess(resp)

        integration = Integration.objects.get(provider=self.provider.key)
        assert integration.external_id == 'TXXXXXXX1'
        assert integration.name == 'Example'
        assert integration.metadata == {
            'access_token': 'xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx',
            'scopes': sorted(self.provider.identity_oauth_scopes),
            'icon': 'http://example.com/ws_icon.jpg',
            'domain_name': 'test-slack-workspace.slack.com',
        }
        oi = OrganizationIntegration.objects.get(
            integration=integration,
            organization=self.organization,
        )
        assert oi.config == {}

        idp = IdentityProvider.objects.get(
            type='slack',
            organization=self.organization,
        )
        identity = Identity.objects.get(
            idp=idp,
            user=self.user,
            external_id='UXXXXXXX1',
        )
        assert identity.status == IdentityStatus.VALID

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
