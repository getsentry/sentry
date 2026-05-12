from __future__ import annotations

from collections.abc import Generator
from time import time
from unittest.mock import Mock, patch
from urllib.parse import parse_qs

import pytest
import responses
from django.urls import reverse

from sentry.identity.vsts.provider import (
    VSTSIdentityProvider,
    VSTSNewOAuth2CallbackView,
    VSTSOAuth2CallbackView,
)
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

        result: dict[str, Any] = view.exchange_token(request, pipeline, "oauth-code")
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

        result: dict[str, Any] = view.exchange_token(request, pipeline, "oauth-code")
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

        new_identity = Identity.objects.get(id=self.identity.id)
        assert new_identity.data["access_token"] == refresh_data["access_token"]
        assert new_identity.data["token_type"] == refresh_data["token_type"]
        assert new_identity.data["expires"] <= int(time())
