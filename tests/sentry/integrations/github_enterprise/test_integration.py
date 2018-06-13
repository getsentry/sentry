from __future__ import absolute_import

import responses
import six
from mock import patch

from six.moves.urllib.parse import parse_qs, urlencode, urlparse

from sentry.integrations.github_enterprise import GitHubEnterpriseIntegrationProvider
from sentry.models import Identity, IdentityProvider, IdentityStatus, Integration, OrganizationIntegration
from sentry.testutils import IntegrationTestCase


class GitHubEnterpriseIntegrationTest(IntegrationTestCase):
    provider = GitHubEnterpriseIntegrationProvider
    config = {
        'url': 'https://35.232.149.196',
        'id': 2,
        'name': 'test-app',
        'client_id': 'client_id',
        'client_secret': 'client_secret',
        'webhook_secret': 'webhook_secret',
        'private_key': 'private_key'
    }

    @patch('sentry.integrations.github_enterprise.integration.get_jwt', return_value='jwt_token_1')
    def assert_setup_flow(self, get_jwt, installation_id='install_id_1', user_id='user_id_1'):
        responses.reset()
        resp = self.client.get(self.init_path)
        assert resp.status_code == 200
        resp = self.client.post(self.init_path, data=self.config)
        assert resp.status_code == 302
        redirect = urlparse(resp['Location'])
        assert redirect.scheme == 'https'
        assert redirect.netloc == '35.232.149.196'
        assert redirect.path == '/github-apps/test-app'

        # App installation ID is provided, mveo thr
        resp = self.client.get('{}?{}'.format(
            self.setup_path,
            urlencode({'installation_id': installation_id})
        ))

        assert resp.status_code == 302
        redirect = urlparse(resp['Location'])
        assert redirect.scheme == 'https'
        assert redirect.netloc == '35.232.149.196'
        assert redirect.path == '/login/oauth/authorize'

        params = parse_qs(redirect.query)
        assert params['state']
        assert params['redirect_uri'] == ['http://testserver/extensions/github-enterprise/setup/']
        assert params['response_type'] == ['code']
        assert params['client_id'] == ['client_id']
        # once we've asserted on it, switch to a singular values to make life
        # easier
        authorize_params = {k: v[0] for k, v in six.iteritems(params)}

        access_token = 'xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx'

        responses.add(
            responses.POST, 'https://35.232.149.196/login/oauth/access_token',
            json={'access_token': access_token}
        )

        responses.add(
            responses.GET, 'https://35.232.149.196/api/v3/user',
            json={'id': user_id}
        )

        responses.add(
            responses.GET,
            u'https://35.232.149.196/api/v3/app/installations/{}'.format(installation_id),
            json={
                'id': installation_id,
                'account': {
                    'login': 'Test Organization',
                    'avatar_url': 'https://35.232.149.196/avatar.png',
                    'html_url': 'https://35.232.149.196/Test-Organization',
                },
            }
        )

        responses.add(
            responses.GET, u'https://35.232.149.196/api/v3/user/installations',
            json={
                'installations': [{'id': installation_id}],
            }
        )

        resp = self.client.get('{}?{}'.format(
            self.setup_path,
            urlencode({
                'code': 'oauth-code',
                'state': authorize_params['state'],
            })
        ))

        mock_access_token_request = responses.calls[0].request
        req_params = parse_qs(mock_access_token_request.body)
        assert req_params['grant_type'] == ['authorization_code']
        assert req_params['code'] == ['oauth-code']
        assert req_params['redirect_uri'] == [
            'http://testserver/extensions/github-enterprise/setup/']
        assert req_params['client_id'] == ['client_id']
        assert req_params['client_secret'] == ['client_secret']

        assert resp.status_code == 200

        auth_header = responses.calls[2].request.headers['Authorization']
        assert auth_header == 'Bearer jwt_token_1'

        self.assertDialogSuccess(resp)

    @responses.activate
    def test_basic_flow(self):
        self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)

        assert integration.external_id == 'install_id_1'
        assert integration.name == 'Test Organization'
        assert integration.metadata == {
            u'access_token': None,
            u'expires_at': None,
            u'icon': u'https://35.232.149.196/avatar.png',
            u'domain_name': u'35.232.149.196',
            u'installation': {
                u'client_id': u'client_id',
                u'client_secret': u'client_secret',
                u'id': u'2',
                u'name': u'test-app',
                u'private_key': u'private_key',
                u'url': u'35.232.149.196',
                u'webhook_secret': u'webhook_secret',
            }
        }
        oi = OrganizationIntegration.objects.get(
            integration=integration,
            organization=self.organization,
        )
        assert oi.config == {}

        idp = IdentityProvider.objects.get(type='github-enterprise')
        identity = Identity.objects.get(
            idp=idp,
            user=self.user,
            external_id='user_id_1',
        )
        assert identity.status == IdentityStatus.VALID
        assert identity.data == {
            'access_token': 'xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx'
        }
