
from __future__ import absolute_import
from mock import Mock
import responses
from sentry.identity.vsts.provider import ConfigView, VSTSOAuth2CallbackView
from sentry.testutils import TestCase
from six.moves.urllib.parse import parse_qs


class TestConfigView(TestCase):
    def setUp(self):
        self.instance = 'example.visualstudio.com'
        self.default_project = 'MyFirstProject'
        self.config_view = ConfigView()
        self.request = Mock()
        self.pipeline = Mock()

    def test_instance_only(self):
        self.request.POST = {
            'instance': self.instance,
        }
        self.config_view.dispatch(self.request, self.pipeline)

        assert self.pipeline.bind_state.call_count == 1
        assert self.pipeline.next_step.call_count == 0

    def test_no_instance(self):
        self.request.POST = {
            'default_project': self.instance,
        }
        self.config_view.dispatch(self.request, self.pipeline)
        assert self.pipeline.bind_state.call_count == 0
        assert self.pipeline.next_step.call_count == 0

    def test_completed_form(self):
        self.request.POST = {
            'instance': self.instance,
            'default_project': self.instance,
        }
        self.config_view.dispatch(self.request, self.pipeline)
        assert self.pipeline.bind_state.call_count == 2
        assert self.pipeline.next_step.call_count == 1


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
