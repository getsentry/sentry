from __future__ import annotations

from collections.abc import Generator
from time import time
from typing import Any
from unittest.mock import MagicMock, Mock, patch
from urllib.parse import parse_qs

import pytest
import responses
from django.forms import ChoiceField
from django.http import HttpRequest
from django.urls import reverse

from sentry.identity.vsts.provider import (
    VSTSIdentityProvider,
    VSTSNewOAuth2CallbackView,
    VSTSOAuth2CallbackView,
)
from sentry.integrations.vsts.integration import AccountConfigView, AccountForm
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test
from sentry.users.models.identity import Identity
from sentry.utils.http import absolute_uri


@control_silo_test
class TestVSTSOAuthCallbackView(TestCase):
    @responses.activate
    def test_exchange_token(self) -> None:
        view = VSTSOAuth2CallbackView(
            access_token_url="https://app.vssps.visualstudio.com/oauth2/token",
            client_id="vsts-client-id",
            client_secret="vsts-client-secret",
        )
        request = Mock()
        pipeline = Mock(
            config={"redirect_url": "https://app.vssps.visualstudio.com/oauth2/authorize"}
        )

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


@control_silo_test
@override_options({"vsts.consent-prompt": True})
class TestVSTSNewOAuth2CallbackView(TestCase):
    @responses.activate
    def test_exchange_token(self) -> None:
        view = VSTSNewOAuth2CallbackView(
            access_token_url="https://login.microsoftonline.com/common/oauth2/v2.0/token",
            client_id="vsts-new-client-id",
            client_secret="vsts-new-client-secret",
        )
        request = Mock()
        pipeline = Mock(
            config={
                "redirect_url": reverse(
                    "sentry-extension-setup", kwargs={"provider_id": "vsts_new"}
                )
            },
            provider=Mock(key="vsts_new"),
        )

        responses.add(
            responses.POST,
            "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            json={
                "access_token": "xxxxxxxxx",
                "token_type": "Bearer",
                "expires_in": 3600,
                "refresh_token": "zzzzzzzzzz",
            },
        )

        result = view.exchange_token(request, pipeline, "oauth-code")
        mock_request = responses.calls[0].request
        req_params = parse_qs(mock_request.body)

        # Verify the correct parameters are sent
        assert req_params["grant_type"] == ["authorization_code"]
        assert req_params["client_id"] == ["vsts-new-client-id"]
        assert req_params["client_secret"] == ["vsts-new-client-secret"]
        assert req_params["code"] == ["oauth-code"]
        assert req_params["prompt"] == ["consent"]

        # Verify the redirect URI is correctly constructed with absolute_uri
        assert req_params["redirect_uri"][0] == absolute_uri(
            reverse("sentry-extension-setup", kwargs={"provider_id": "vsts_new"})
        )

        # Verify the response is correctly parsed
        assert result["access_token"] == "xxxxxxxxx"
        assert result["token_type"] == "Bearer"
        assert result["expires_in"] == 3600
        assert result["refresh_token"] == "zzzzzzzzzz"

    @responses.activate
    def test_exchange_token_without_consent_prompt(self) -> None:
        view = VSTSNewOAuth2CallbackView(
            access_token_url="https://login.microsoftonline.com/common/oauth2/v2.0/token",
            client_id="vsts-new-client-id",
            client_secret="vsts-new-client-secret",
        )
        request = Mock()
        pipeline = Mock(
            config={
                "redirect_url": reverse(
                    "sentry-extension-setup", kwargs={"provider_id": "vsts_new"}
                )
            },
            provider=Mock(key="vsts_new"),
        )

        responses.add(
            responses.POST,
            "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            json={
                "access_token": "xxxxxxxxx",
                "token_type": "Bearer",
                "expires_in": 3600,
                "refresh_token": "zzzzzzzzzz",
            },
        )

        result = view.exchange_token(request, pipeline, "oauth-code")
        mock_request = responses.calls[0].request
        req_params = parse_qs(mock_request.body)

        # Verify the correct parameters are sent
        assert req_params["grant_type"] == ["authorization_code"]
        assert req_params["client_id"] == ["vsts-new-client-id"]
        assert req_params["client_secret"] == ["vsts-new-client-secret"]
        assert req_params["code"] == ["oauth-code"]

        # Verify the redirect URI is correctly constructed with absolute_uri
        assert req_params["redirect_uri"][0] == absolute_uri(
            reverse("sentry-extension-setup", kwargs={"provider_id": "vsts_new"})
        )

        # Verify the response is correctly parsed
        assert result["access_token"] == "xxxxxxxxx"
        assert result["token_type"] == "Bearer"
        assert result["expires_in"] == 3600
        assert result["refresh_token"] == "zzzzzzzzzz"


@control_silo_test
class TestAccountConfigView(TestCase):
    def setUp(self) -> None:
        responses.reset()
        account_id = "1234567-8910"
        self.base_url = "http://sentry2.visualstudio.com/"
        self.accounts: list[dict[str, Any]] = [
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
    def test_dispatch(self) -> None:
        view = AccountConfigView()
        request = HttpRequest()
        request.POST.update({"account": "1234567-8910"})

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
    def test_get_accounts(self) -> None:
        view = AccountConfigView()
        accounts = view.get_accounts("access-token", 123)
        assert accounts is not None
        assert accounts["value"][0]["accountName"] == "sentry"
        assert accounts["value"][1]["accountName"] == "sentry2"

    @responses.activate
    def test_account_form(self) -> None:
        account_form = AccountForm(self.accounts)
        field = account_form.fields["account"]
        assert isinstance(field, ChoiceField)
        assert field.choices == [
            ("1234567-89", "sentry"),
            ("1234567-8910", "sentry2"),
        ]

    @responses.activate
    @patch("sentry.integrations.vsts.integration.get_user_info")
    @patch("sentry.integrations.vsts.integration.render_to_response")
    def test_no_accounts_received(
        self, mock_render_to_response: MagicMock, mock_get_user_info: MagicMock
    ) -> None:
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


@control_silo_test
class VstsIdentityProviderTest(TestCase):
    client_secret = "12345678"

    def setUp(self) -> None:
        self.identity_provider_model = self.create_identity_provider(type="vsts")
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

    @pytest.fixture(autouse=True)
    def patch_get_oauth_client_secret(self) -> Generator[None]:
        with patch.object(
            VSTSIdentityProvider, "get_oauth_client_secret", return_value=self.client_secret
        ):
            yield

    @responses.activate
    def test_refresh_identity(self) -> None:
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
        
        # Verify the correct parameters are sent in the refresh request
        mock_request = responses.calls[0].request
        req_params = parse_qs(mock_request.body)
        
        assert req_params["grant_type"] == ["refresh_token"]
        assert req_params["refresh_token"] == ["n354678"]  # original refresh token from identity
        assert req_params["client_assertion"] == [self.client_secret]
        assert req_params["client_assertion_type"] == [
            "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
        ]
        assert "redirect_uri" in req_params

        new_identity = Identity.objects.get(id=self.identity.id)
        assert new_identity.data["access_token"] == refresh_data["access_token"]
        assert new_identity.data["token_type"] == refresh_data["token_type"]
        assert new_identity.data["expires"] <= int(time())
