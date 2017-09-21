from __future__ import absolute_import

import responses
import six

from six.moves.urllib.parse import parse_qs, urlencode, urlparse

from sentry.integrations.slack import SlackIntegration
from sentry.models import (
    Identity, IdentityProvider, IdentityStatus, Integration,
    OrganizationIntegration, UserIdentity
)
from sentry.testutils import IntegrationTestCase


class SlackIntegrationTest(IntegrationTestCase):
    provider = SlackIntegration

    @responses.activate
    def test_basic_flow(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 302
        redirect = urlparse(resp['Location'])
        assert redirect.scheme == 'https'
        assert redirect.netloc == 'slack.com'
        assert redirect.path == '/oauth/authorize'
        params = parse_qs(redirect.query)
        assert params['scope'] == ['bot chat:write:bot commands team:read']
        assert params['state']
        assert params['redirect_uri'] == ['http://testserver/extensions/slack/setup/']
        assert params['response_type'] == ['code']
        assert params['client_id'] == ['slack-client-id']
        # once we've asserted on it, switch to a singular values to make life
        # easier
        authorize_params = {k: v[0] for k, v in six.iteritems(params)}

        responses.add(
            responses.POST, 'https://slack.com/api/oauth.access',
            json={
                'ok': True,
                'user_id': 'UXXXXXXX0',
                'access_token': 'xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx',
                'team_id': 'TXXXXXXX0',
                'team_name': 'Example',
                'bot': {
                    'bot_access_token': 'xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx',
                    'bot_user_id': 'UXXXXXXX1',
                },
                'scope': ','.join(authorize_params['scope'].split(' ')),
            })

        resp = self.client.get('{}?{}'.format(
            self.path,
            urlencode({
                'code': 'oauth-code',
                'state': authorize_params['state'],
            })
        ))

        mock_request = responses.calls[-1].request
        req_params = parse_qs(mock_request.body)
        assert req_params['grant_type'] == ['authorization_code']
        assert req_params['code'] == ['oauth-code']
        assert req_params['redirect_uri'] == ['http://testserver/extensions/slack/setup/']
        assert req_params['client_id'] == ['slack-client-id']
        assert req_params['client_secret'] == ['slack-client-secret']

        assert resp.status_code == 200
        self.assertDialogSuccess(resp)

        integration = Integration.objects.get(provider=self.provider.id)
        assert integration.external_id == 'TXXXXXXX0'
        assert integration.name == 'Example'
        assert integration.metadata == {
            'bot_access_token': 'xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx',
            'bot_user_id': 'UXXXXXXX1',
            'scopes': ['bot', 'chat:write:bot', 'commands', 'team:read'],
        }
        oi = OrganizationIntegration.objects.get(
            integration=integration,
            organization=self.organization,
        )
        assert oi.config == {}

        idp = IdentityProvider.objects.get(
            type='slack',
            instance='slack.com',
        )
        identity = Identity.objects.get(
            idp=idp,
            external_id='UXXXXXXX0',
        )
        assert identity.status == IdentityStatus.VALID
        assert identity.scopes == ['bot', 'chat:write:bot', 'commands', 'team:read']
        assert identity.data == {
            'access_token': 'xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx',
        }

        assert UserIdentity.objects.filter(
            user=self.user,
            identity=identity,
        ).exists()
