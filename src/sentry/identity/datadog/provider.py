from __future__ import annotations

import base64
import hashlib
import secrets

from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from requests import Response

from sentry.http import safe_urlopen
from sentry.identity.oauth2 import (
    OAuth2CallbackView,
    OAuth2LoginView,
    _redirect_url,
)
from sentry.identity.pipeline import IdentityPipeline
from sentry.utils.http import absolute_uri


def generate_pkce_code_verifier() -> str:
    return secrets.token_urlsafe(96)


def generate_pkce_code_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


class DatadogOAuth2LoginView(OAuth2LoginView):
    """OAuth2LoginView with PKCE (RFC 7636) for Datadog MCP.

    Adds code_challenge and code_challenge_method to the authorize redirect and
    stores the code_verifier in pipeline state for the callback view.
    """

    _code_verifier: str | None = None

    def dispatch(self, request: HttpRequest, pipeline: IdentityPipeline) -> HttpResponseBase:
        # Ensure a code verifier exists and is bound to the pipeline.
        if existing_code_verifier := pipeline.fetch_state("pkce_code_verifier"):
            self._code_verifier = existing_code_verifier
        else:
            self._code_verifier = generate_pkce_code_verifier()
            pipeline.bind_state("pkce_code_verifier", self._code_verifier)

        return super().dispatch(request, pipeline)

    def get_authorize_params(self, state: str, redirect_uri: str) -> dict[str, str | None]:
        params = super().get_authorize_params(state, redirect_uri)

        # Use the code verifier to generate the code challenge.
        assert self._code_verifier is not None
        params["code_challenge"] = generate_pkce_code_challenge(self._code_verifier)
        params["code_challenge_method"] = "S256"
        return params


class DatadogOAuth2CallbackView(OAuth2CallbackView):
    """OAuth2CallbackView with PKCE (RFC 7636) for Datadog MCP.

    Token exchange sends code_verifier in the POST body and authenticates via
    HTTP Basic (client_secret_basic). Datadog's MCP token endpoint rejects
    client_secret_post, so credentials must not appear in the POST body.
    """

    def exchange_token(
        self, request: HttpRequest, pipeline: IdentityPipeline, code: str
    ) -> dict[str, str]:
        try:
            return super().exchange_token(request, pipeline, code)
        except KeyError:
            # The KeyError is already recorded as a lifecycle failure by the
            # record_event context manager in super().exchange_token before propagating.
            return {
                "error": "pkce_missing",
                "error_description": "PKCE code_verifier missing from pipeline state",
            }

    def get_token_params(self, code: str, redirect_uri: str) -> dict[str, str | None]:
        return {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
        }

    def get_access_token(self, pipeline: IdentityPipeline, code: str) -> Response:
        data = self.get_token_params(code=code, redirect_uri=absolute_uri(_redirect_url(pipeline)))

        # Add code verifier to the token params.
        code_verifier = pipeline.fetch_state("pkce_code_verifier")
        if not code_verifier:
            raise KeyError("PKCE code_verifier missing from pipeline state")
        data["code_verifier"] = code_verifier

        # Include client id and secret in header.
        basic = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode()).decode("ascii")
        headers = {"Authorization": f"Basic {basic}"}

        verify_ssl = pipeline.config.get("verify_ssl", True)
        return safe_urlopen(
            self.access_token_url, data=data, headers=headers, verify_ssl=verify_ssl
        )
