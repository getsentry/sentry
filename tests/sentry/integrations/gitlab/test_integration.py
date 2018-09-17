from __future__ import absolute_import

import responses
import six

from six.moves.urllib.parse import parse_qs, urlencode, urlparse

from sentry.integrations.gitlab import GitlabIntegrationProvider
from sentry.models import (
    Identity, IdentityProvider, IdentityStatus, Integration, OrganizationIntegration,
)
from sentry.testutils import IntegrationTestCase


class GitlabIntegrationTest(IntegrationTestCase):
    provider = GitlabIntegrationProvider
    config = {
        'url': 'https://gitlab.example.com',
        'name': 'Test App',
        'group': 'cool-group',
        'verify_ssl': True,
        'client_id': 'client_id',
        'client_secret': 'client_secret'
    }

    def assert_setup_flow(self, user_id='user_id_1', group_id=4):
        responses.reset()
        resp = self.client.get(self.init_path)
        assert resp.status_code == 200
        resp = self.client.post(self.init_path, data=self.config)
        assert resp.status_code == 302
        redirect = urlparse(resp['Location'])
        assert redirect.scheme == 'https'
        assert redirect.netloc == 'gitlab.example.com'
        assert redirect.path == '/oauth/authorize'

        params = parse_qs(redirect.query)
        assert params['state']
        assert params['redirect_uri'] == ['http://testserver/extensions/gitlab/setup/']
        assert params['response_type'] == ['code']
        assert params['client_id'] == ['client_id']
        # once we've asserted on it, switch to a singular values to make life
        # easier
        authorize_params = {k: v[0] for k, v in six.iteritems(params)}

        access_token = 'xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx'

        responses.add(
            responses.POST, 'https://gitlab.example.com/oauth/token',
            json={'access_token': access_token}
        )

        responses.add(
            responses.GET, 'https://gitlab.example.com/api/v4/user',
            json={'id': user_id}
        )

        responses.add(
            responses.GET, u'https://gitlab.example.com/api/v4/groups/cool-group',
            json={
                'id': group_id,
                'name': 'Cool',
                'web_url': 'https://gitlab.example.com/groups/cool-group',
                'avatar_url': 'https://gitlab.example.com/uploads/group/avatar/4/foo.jpg',
            }
        )

        resp = self.client.get(u'{}?{}'.format(
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
            'http://testserver/extensions/gitlab/setup/']
        assert req_params['client_id'] == ['client_id']
        assert req_params['client_secret'] == ['client_secret']

        assert resp.status_code == 200

        self.assertDialogSuccess(resp)

    @responses.activate
    def test_basic_flow(self):
        self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)

        assert integration.external_id == 'gitlab.example.com:4'
        assert integration.name == 'Cool'
        assert integration.metadata == {
            u'scopes': ['api', 'sudo'],
            u'icon': u'https://gitlab.example.com/uploads/group/avatar/4/foo.jpg',
            u'domain_name': u'gitlab.example.com/groups/cool-group',
            u'verify_ssl': True,
        }
        oi = OrganizationIntegration.objects.get(
            integration=integration,
            organization=self.organization,
        )
        assert oi.config == {}

        idp = IdentityProvider.objects.get(type='gitlab')
        identity = Identity.objects.get(
            idp=idp,
            user=self.user,
            external_id='user_id_1',
        )
        assert identity.status == IdentityStatus.VALID
        assert identity.data == {
            'access_token': 'xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx'
        }
