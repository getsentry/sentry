from __future__ import absolute_import

import responses
import six

from six.moves.urllib.parse import parse_qs, urlencode, urlparse

from sentry.integrations.slack import SlackIntegration
from sentry.models import Identity, IdentityProvider, IdentityStatus, Integration, OrganizationIntegration
from sentry.testutils import IntegrationTestCase


class SlackIntegrationTest(IntegrationTestCase):
    provider = SlackIntegration

    def assert_setup_flow(self, team_id='TXXXXXXX1', installer_user_id='UXXXXXXX1'):
        responses.reset()

        resp = self.client.get(self.init_path)
        assert resp.status_code == 302
        redirect = urlparse(resp['Location'])
        assert redirect.scheme == 'https'
        assert redirect.netloc == 'slack.com'
        assert redirect.path == '/oauth/authorize'
        params = parse_qs(redirect.query)
        assert params['scope'] == [' '.join(self.provider.identity_oauth_scopes)]
        assert params['state']
        assert params['redirect_uri'] == ['http://testserver/extensions/slack/setup/']
        assert params['response_type'] == ['code']
        assert params['client_id'] == ['slack-client-id']
        # once we've asserted on it, switch to a singular values to make life
        # easier
        authorize_params = {k: v[0] for k, v in six.iteritems(params)}

        responses.add(
            responses.POST, 'https://slack.com/api/oauth.token',
            json={
                'ok': True,
                'user_id': installer_user_id,
                'access_token': 'xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx',
                'team_id': team_id,
                'team_name': 'Example',
                'installer_user_id': installer_user_id,
            }
        )

        responses.add(
            responses.GET, 'https://slack.com/api/team.info',
            json={
                'ok': True,
                'team': {
                    'domain': 'test-slack-workspace',
                    'icon': {'image_132': 'http://example.com/ws_icon.jpg'},
                },
            }
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
        assert req_params['grant_type'] == ['authorization_code']
        assert req_params['code'] == ['oauth-code']
        assert req_params['redirect_uri'] == ['http://testserver/extensions/slack/setup/']
        assert req_params['client_id'] == ['slack-client-id']
        assert req_params['client_secret'] == ['slack-client-secret']

        assert resp.status_code == 200
        self.assertDialogSuccess(resp)

    @responses.activate
    def test_basic_flow(self):
        self.assert_setup_flow()

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
    def test_multiple_integrations(self):
        self.assert_setup_flow()
        self.assert_setup_flow(team_id='TXXXXXXX2', installer_user_id='UXXXXXXX2')

        integrations = Integration.objects.filter(provider=self.provider.key)

        assert integrations.count() == 2
        assert integrations[0].external_id == 'TXXXXXXX1'
        assert integrations[1].external_id == 'TXXXXXXX2'

        oi = OrganizationIntegration.objects.get(
            integration=integrations[1],
            organization=self.organization,
        )
        assert oi.config == {}

        idps = IdentityProvider.objects.filter(
            type='slack',
            organization=self.organization,
        )

        assert idps.count() == 2

        identities = Identity.objects.all()

        assert identities.count() == 2
        assert identities[0].external_id != identities[1].external_id
        assert identities[0].idp != identities[1].idp
