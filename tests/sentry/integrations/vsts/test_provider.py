
from __future__ import absolute_import
from mock import Mock
import responses
from django.http import HttpRequest
from sentry.identity.vsts.provider import VSTSOAuth2CallbackView, AccountConfigView, AccountForm
from sentry.testutils import TestCase
from six.moves.urllib.parse import parse_qs


class TestVSTSOAuthCallbackView(TestCase):
    @responses.activate
    def test_exchange_token(self):
        def redirect_url():
            return 'https://app.vssps.visualstudio.com/oauth2/authorize'

        view = VSTSOAuth2CallbackView(
            access_token_url='https://app.vssps.visualstudio.com/oauth2/token',
            client_id='vsts-client-id',
            client_secret='vsts-client-secret',
        )
        request = Mock()
        pipeline = Mock()

        pipeline.redirect_url = redirect_url

        responses.add(
            responses.POST, 'https://app.vssps.visualstudio.com/oauth2/token',
            json={
                'access_token': 'xxxxxxxxx',
                'token_type': 'jwt-bearer',
                'expires_in': '3599',
                'refresh_token': 'zzzzzzzzzz',
            },
        )

        result = view.exchange_token(request, pipeline, 'oauth-code')
        mock_request = responses.calls[0].request
        req_params = parse_qs(mock_request.body)

        assert req_params['grant_type'] == ['urn:ietf:params:oauth:grant-type:jwt-bearer']
        assert req_params['assertion'] == ['oauth-code']
        assert req_params['redirect_uri'] == ['https://app.vssps.visualstudio.com/oauth2/authorize']
        assert req_params['client_assertion_type'] == [
            'urn:ietf:params:oauth:client-assertion-type:jwt-bearer']
        assert req_params['client_assertion'] == ['vsts-client-secret']

        assert result['access_token'] == 'xxxxxxxxx'
        assert result['token_type'] == 'jwt-bearer'
        assert result['expires_in'] == '3599'
        assert result['refresh_token'] == 'zzzzzzzzzz'


class TestAccountConfigView(TestCase):
    def setUp(self):
        self.accounts = [
            {
                'AccountId': '1234567-89',
                'NamespaceId': '00000000-0000-0000-0000-000000000000',
                'AccountName': 'sentry',
                'OrganizationName': None,
                'AccountType': 0,
                'AccountOwner': '00000000-0000-0000-0000-000000000000',
                'CreatedBy': '00000000-0000-0000-0000-000000000000',
                'CreatedDate': '0001-01-01T00:00:00',
                'AccountStatus': 0,
                'StatusReason': None,
                'LastUpdatedBy': '00000000-0000-0000-0000-000000000000',
                'Properties': {},
            },
            {
                'AccountId': '1234567-8910',
                'NamespaceId': '00000000-0000-0000-0000-000000000000',
                'AccountName': 'sentry2',
                'OrganizationName': None,
                'AccountType': 0,
                'AccountOwner': '00000000-0000-0000-0000-000000000000',
                'CreatedBy': '00000000-0000-0000-0000-000000000000',
                'CreatedDate': '0001-01-01T00:00:00',
                'AccountStatus': 0,
                'StatusReason': None,
                'LastUpdatedBy': '00000000-0000-0000-0000-000000000000',
                'Properties': {},
            },

        ]
        responses.add(
            responses.GET,
            'https://app.vssps.visualstudio.com/_apis/accounts',
            json=self.accounts,
            status=200,

        )

    @responses.activate
    def test_dispatch(self):
        view = AccountConfigView()
        request = HttpRequest()
        request.POST = {'account': '1234567-8910'}

        pipeline = Mock()
        pipeline.state = {'accounts': self.accounts}
        pipeline.fetch_state = lambda key: pipeline.state[key]
        pipeline.bind_state = lambda name, value: pipeline.state.update({name: value})

        view.dispatch(request, pipeline)

        assert pipeline.fetch_state(key='instance') == 'sentry2.visualstudio.com'
        assert pipeline.fetch_state(key='account') == self.accounts[1]
        assert pipeline.next_step.call_count == 1

    @responses.activate
    def test_get_accounts(self):
        view = AccountConfigView()
        accounts = view.get_accounts('access-token')
        assert accounts[0]['AccountName'] == 'sentry'
        assert accounts[1]['AccountName'] == 'sentry2'

    def test_account_form(self):
        account_form = AccountForm(self.accounts)
        assert account_form.fields['account'].choices == [
            ('1234567-89', 'sentry'), ('1234567-8910', 'sentry2')]
