from __future__ import absolute_import
from sentry.utils.compat.mock import Mock, patch
import responses
from django.http import HttpRequest
from sentry.identity.vsts.provider import VSTSOAuth2CallbackView, VSTSIdentityProvider
from sentry.integrations.vsts.integration import AccountConfigView, AccountForm
from sentry.testutils import TestCase
from six.moves.urllib.parse import parse_qs
from sentry.utils.http import absolute_uri
from sentry.models import Identity, IdentityProvider
from time import time


class TestVSTSOAuthCallbackView(TestCase):
    @responses.activate
    def test_exchange_token(self):
        def redirect_url():
            return "https://app.vssps.visualstudio.com/oauth2/authorize"

        view = VSTSOAuth2CallbackView(
            access_token_url="https://app.vssps.visualstudio.com/oauth2/token",
            client_id="vsts-client-id",
            client_secret="vsts-client-secret",
        )
        request = Mock()
        pipeline = Mock()

        pipeline.redirect_url = redirect_url

        responses.add(
            responses.POST,
            "https://app.vssps.visualstudio.com/oauth2/token",
            json={
                "access_token": "xxxxxxxxx",
                "token_type": "jwt-bearer",
                "expires_in": "3599",
                "refresh_token": "zzzzzzzzzz",
            },
        )

        result = view.exchange_token(request, pipeline, "oauth-code")
        mock_request = responses.calls[0].request
        req_params = parse_qs(mock_request.body)

        assert req_params["grant_type"] == ["urn:ietf:params:oauth:grant-type:jwt-bearer"]
        assert req_params["assertion"] == ["oauth-code"]
        assert req_params["redirect_uri"] == ["https://app.vssps.visualstudio.com/oauth2/authorize"]
        assert req_params["client_assertion_type"] == [
            "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
        ]
        assert req_params["client_assertion"] == ["vsts-client-secret"]

        assert result["access_token"] == "xxxxxxxxx"
        assert result["token_type"] == "jwt-bearer"
        assert result["expires_in"] == "3599"
        assert result["refresh_token"] == "zzzzzzzzzz"


class TestAccountConfigView(TestCase):
    def setUp(self):
        responses.reset()
        account_id = "1234567-8910"
        self.base_url = "http://sentry2.visualstudio.com/"
        self.accounts = [
            {
                "accountId": "1234567-89",
                "NamespaceId": "00000000-0000-0000-0000-000000000000",
                "accountName": "sentry",
                "OrganizationName": None,
                "AccountType": 0,
                "AccountOwner": "00000000-0000-0000-0000-000000000000",
                "CreatedBy": "00000000-0000-0000-0000-000000000000",
                "CreatedDate": "0001-01-01T00:00:00",
                "AccountStatus": 0,
                "StatusReason": None,
                "LastUpdatedBy": "00000000-0000-0000-0000-000000000000",
                "Properties": {},
            },
            {
                "accountId": account_id,
                "NamespaceId": "00000000-0000-0000-0000-000000000000",
                "accountName": "sentry2",
                "OrganizationName": None,
                "AccountType": 0,
                "AccountOwner": "00000000-0000-0000-0000-000000000000",
                "CreatedBy": "00000000-0000-0000-0000-000000000000",
                "CreatedDate": "0001-01-01T00:00:00",
                "AccountStatus": 0,
                "StatusReason": None,
                "LastUpdatedBy": "00000000-0000-0000-0000-000000000000",
                "Properties": {},
            },
        ]
        responses.add(
            responses.GET,
            "https://app.vssps.visualstudio.com/_apis/accounts",
            json={"value": self.accounts, "count": len(self.accounts)},
            status=200,
        )
        responses.add(
            responses.GET,
            "https://app.vssps.visualstudio.com/_apis/resourceareas/79134C72-4A58-4B42-976C-04E7115F32BF?hostId=%s&api-preview=5.0-preview.1"
            % account_id,
            json={"locationUrl": self.base_url},
        )

    @responses.activate
    def test_dispatch(self):
        view = AccountConfigView()
        request = HttpRequest()
        request.POST = {"account": "1234567-8910"}

        pipeline = Mock()
        pipeline.state = {
            "accounts": self.accounts,
            "identity": {"data": {"access_token": "123456789"}},
        }
        pipeline.fetch_state = lambda key: pipeline.state[key]
        pipeline.bind_state = lambda name, value: pipeline.state.update({name: value})

        view.dispatch(request, pipeline)

        assert pipeline.fetch_state(key="account") == self.accounts[1]
        assert pipeline.next_step.call_count == 1

    @responses.activate
    def test_get_accounts(self):
        view = AccountConfigView()
        accounts = view.get_accounts("access-token", "user-id")
        assert accounts["value"][0]["accountName"] == "sentry"
        assert accounts["value"][1]["accountName"] == "sentry2"

    def test_account_form(self):
        account_form = AccountForm(self.accounts)
        assert account_form.fields["account"].choices == [
            ("1234567-89", "sentry"),
            ("1234567-8910", "sentry2"),
        ]

    @responses.activate
    @patch("sentry.integrations.vsts.integration.get_user_info")
    @patch("sentry.integrations.vsts.integration.render_to_response")
    def test_no_accounts_received(self, mock_render_to_response, mock_get_user_info):
        responses.reset()
        responses.add(
            responses.GET,
            "https://app.vssps.visualstudio.com/_apis/accounts",
            json={"value": [], "count": 0},
            status=200,
        )

        view = AccountConfigView()
        request = Mock()
        request.POST = {}
        request.user = self.user

        pipeline = Mock()
        pipeline.fetch_state = lambda key: {"data": {"access_token": "1234567890"}}
        pipeline.organization = self.organization

        view.dispatch(request, pipeline)
        assert mock_get_user_info.called is True
        assert mock_render_to_response.called is True
        assert mock_render_to_response.call_args[1]["context"] == {"no_accounts": True}


class VstsIdentityProviderTest(TestCase):
    def setUp(self):
        self.identity_provider_model = IdentityProvider.objects.create(type="vsts")
        self.identity = Identity.objects.create(
            idp=self.identity_provider_model,
            user=self.user,
            external_id="vsts_id",
            data={
                "access_token": "123456789",
                "token_type": "token_type",
                "expires": 12345678,
                "refresh_token": "n354678",
            },
        )
        self.provider = VSTSIdentityProvider()
        self.client_secret = "12345678"
        self.provider.get_oauth_client_secret = lambda: self.client_secret

    def get_refresh_token_params(self):
        refresh_token = "wertyui"
        params = self.provider.get_refresh_token_params(refresh_token)
        assert params == {
            "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            "client_assertion": self.client_secret,
            "grant_type": "refresh_token",
            "assertion": refresh_token,
            "redirect_uri": absolute_uri(self.provider.oauth_redirect_url),
        }

    @responses.activate
    def test_refresh_identity(self):
        refresh_data = {
            "access_token": "access token for this user",
            "token_type": "type of token",
            "expires": 1234567,
            "refresh_token": "new refresh token to use when the token has timed out",
        }
        responses.add(
            responses.POST, "https://app.vssps.visualstudio.com/oauth2/token", json=refresh_data
        )
        self.provider.refresh_identity(self.identity, redirect_url="redirect_url")

        assert len(responses.calls) == 1

        new_identity = Identity.objects.get(id=self.identity.id)
        assert new_identity.data["access_token"] == refresh_data["access_token"]
        assert new_identity.data["token_type"] == refresh_data["token_type"]
        assert new_identity.data["expires"] <= int(time())
