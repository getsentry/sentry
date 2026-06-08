from __future__ import annotations

import logging
from typing import Any

import orjson

from sentry import options
from sentry.http import safe_urlopen, safe_urlread
from sentry.identity.oauth2 import (
    OAuth2Provider,
    PkceOAuth2CallbackView,
    PkceOAuth2LoginView,
)
from sentry.identity.pipeline import IdentityPipeline
from sentry.identity.services.identity.model import RpcIdentity
from sentry.integrations.types import IntegrationProviderSlug
from sentry.pipeline.views.base import PipelineView
from sentry.users.models.identity import Identity

logger = logging.getLogger(__name__)


def get_user_info(access_token: str, site: str) -> dict[str, Any]:
    """Fetch the current Datadog user via ``GET /api/v2/current_user``.

    Returns the ``data`` object containing ``id`` (user UUID) and
    ``attributes`` (name, email, handle, etc.).
    """
    url = f"https://api.{site}/api/v2/current_user"
    resp = safe_urlopen(url, method="GET", headers={"Authorization": f"Bearer {access_token}"})
    resp.raise_for_status()

    body = orjson.loads(safe_urlread(resp))
    return body["data"]


class DatadogIdentityProvider(OAuth2Provider):
    key = IntegrationProviderSlug.DATADOG
    name = "Datadog"

    oauth_scopes: tuple[str, ...] = ()

    def get_oauth_client_id(self) -> str:
        return options.get("datadog.client-id")

    def get_oauth_client_secret(self) -> str:
        return options.get("datadog.client-secret")

    def get_oauth_authorize_url(self) -> str:
        site = self._get_site()
        return f"https://app.{site}/oauth2/v1/authorize"

    def get_oauth_access_token_url(self) -> str:
        site = self._get_site()
        return f"https://app.{site}/oauth2/v1/token"

    def _get_site(self) -> str:
        """Return the Datadog site from IdentityProvider.config.

        e.g. ``datadoghq.com``, ``us3.datadoghq.com``, ``datadoghq.eu``.
        """
        return self._get_oauth_parameter("site")

    def get_pipeline_views(self) -> list[PipelineView[IdentityPipeline]]:
        return [
            PkceOAuth2LoginView(
                authorize_url=self.get_oauth_authorize_url(),
                client_id=self.get_oauth_client_id(),
                scope=" ".join(self.get_oauth_scopes()),
            ),
            PkceOAuth2CallbackView(
                access_token_url=self.get_oauth_access_token_url(),
                client_id=self.get_oauth_client_id(),
                client_secret=self.get_oauth_client_secret(),
            ),
        ]

    def get_oauth_data(self, payload: dict[str, Any]) -> dict[str, Any]:
        data = super().get_oauth_data(payload)
        if "scope" in payload:
            data["scope"] = payload["scope"]
        return data

    def build_identity(self, data: dict[str, Any]) -> dict[str, Any]:
        token_data = data["data"]
        access_token = token_data.get("access_token")
        if not access_token:
            raise ValueError("Datadog token exchange did not return an access_token")

        user = get_user_info(access_token, self._get_site())

        return {
            "type": IntegrationProviderSlug.DATADOG,
            "id": user["id"],
            "email": user.get("attributes", {}).get("email"),
            "name": user.get("attributes", {}).get("name"),
            "scopes": [],
            "data": self.get_oauth_data(token_data),
        }

    def get_refresh_token_url(self) -> str:
        return self.get_oauth_access_token_url()

    def get_refresh_token_params(
        self, refresh_token: str, identity: Identity | RpcIdentity, **kwargs: Any
    ) -> dict[str, str | None]:
        return {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": self.get_oauth_client_id(),
            "client_secret": self.get_oauth_client_secret(),
        }


import base64
import hashlib
import secrets

from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from requests import Response

from sentry.identity.oauth2 import (
    OAuth2CallbackView,
    OAuth2LoginView,
    _redirect_url,
)
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
