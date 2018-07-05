from __future__ import absolute_import

import responses
import six
from mock import patch
from six.moves.urllib.parse import parse_qs, urlencode, urlparse

from sentry.integrations.github import GitHubIntegrationProvider
from sentry.models import (
    Identity, IdentityProvider, IdentityStatus, Integration, OrganizationIntegration,
)
from sentry.testutils import IntegrationTestCase


class GitHubIntegrationTest(IntegrationTestCase):
    provider = GitHubIntegrationProvider

    @patch('sentry.integrations.github.integration.get_jwt', return_value='jwt_token_1')
    def assert_setup_flow(self, get_jwt, installation_id='install_id_1',
                          app_id='app_1', user_id='user_id_1'):
        responses.reset()

        resp = self.client.get(self.init_path)
        assert resp.status_code == 302
        redirect = urlparse(resp['Location'])
        assert redirect.scheme == 'https'
        assert redirect.netloc == 'github.com'
        assert redirect.path == '/apps/sentry-test-app'

        # App installation ID is provided, mveo thr
        resp = self.client.get('{}?{}'.format(
            self.setup_path,
            urlencode({'installation_id': installation_id})
        ))

        assert resp.status_code == 302
        redirect = urlparse(resp['Location'])
        assert redirect.scheme == 'https'
        assert redirect.netloc == 'github.com'
        assert redirect.path == '/login/oauth/authorize'

        params = parse_qs(redirect.query)
        assert params['state']
        assert params['redirect_uri'] == ['http://testserver/extensions/github/setup/']
        assert params['response_type'] == ['code']
        assert params['client_id'] == ['github-client-id']
        # once we've asserted on it, switch to a singular values to make life
        # easier
        authorize_params = {k: v[0] for k, v in six.iteritems(params)}

        access_token = 'xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx'

        responses.add(
            responses.POST, 'https://github.com/login/oauth/access_token',
            json={'access_token': access_token}
        )

        responses.add(
            responses.GET, 'https://api.github.com/user',
            json={'id': user_id}
        )

        responses.add(
            responses.GET,
            u'https://api.github.com/app/installations/{}'.format(installation_id),
            json={
                'id': installation_id,
                'app_id': app_id,
                'account': {
                    'login': 'Test Organization',
                    'avatar_url': 'http://example.com/avatar.png',
                    'html_url': 'https://github.com/Test-Organization',
                },
            }
        )

        responses.add(
            responses.GET, u'https://api.github.com/user/installations',
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
        assert req_params['redirect_uri'] == ['http://testserver/extensions/github/setup/']
        assert req_params['client_id'] == ['github-client-id']
        assert req_params['client_secret'] == ['github-client-secret']

        assert resp.status_code == 200

        auth_header = responses.calls[2].request.headers['Authorization']
        assert auth_header == 'Bearer jwt_token_1'

        self.assertDialogSuccess(resp)
        return resp

    @responses.activate
    def test_basic_flow(self):
        self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)

        assert integration.external_id == 'install_id_1'
        assert integration.name == 'Test Organization'
        assert integration.metadata == {
            'access_token': None,
            'expires_at': None,
            'icon': 'http://example.com/avatar.png',
            'domain_name': 'github.com/Test-Organization',
        }
        oi = OrganizationIntegration.objects.get(
            integration=integration,
            organization=self.organization,
        )
        assert oi.config == {}

        idp = IdentityProvider.objects.get(type='github')
        identity = Identity.objects.get(
            idp=idp,
            user=self.user,
            external_id='user_id_1',
        )
        assert identity.status == IdentityStatus.VALID
        assert identity.data == {
            'access_token': 'xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx'
        }

    @responses.activate
    def test_reassign_user(self):
        self.assert_setup_flow()

        # Associate the identity with a user that has a password.
        # Identity should be relinked.
        user2 = self.create_user()
        Identity.objects.get().update(user=user2)
        self.assert_setup_flow()
        identity = Identity.objects.get()
        assert identity.user == self.user

        # Associate the identity with a user without a password.
        # Identity should not be relinked.
        user2.set_unusable_password()
        user2.save()
        Identity.objects.get().update(user=user2)
        resp = self.assert_setup_flow()
        assert '"success":false' in resp.content
        assert 'The provided Github account is linked to a different user' in resp.content
