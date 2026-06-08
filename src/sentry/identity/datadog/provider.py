from __future__ import annotations

import base64
import hashlib
import logging
import secrets
from typing import Any

import orjson
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from requests import Response
from requests.exceptions import HTTPError

from sentry.auth.exceptions import IdentityNotValid
from sentry.http import safe_urlopen, safe_urlread
from sentry.identity.oauth2 import (
    OAuth2CallbackView,
    OAuth2LoginView,
    OAuth2Provider,
    _redirect_url,
)
from sentry.identity.pipeline import IdentityPipeline
from sentry.identity.services.identity.model import RpcIdentity
from sentry.integrations.types import IntegrationProviderSlug
from sentry.pipeline.views.base import PipelineView
from sentry.shared_integrations.exceptions import ApiError, ApiInvalidRequestError, ApiUnauthorized
from sentry.users.models.identity import Identity
from sentry.utils.http import absolute_uri

logger = logging.getLogger(__name__)

MCP_REGISTER_PATH = "/api/unstable/mcp-server/register"
MCP_AUTHORIZE_PATH = "/api/unstable/mcp-server/authorize"
MCP_TOKEN_PATH = "/api/unstable/mcp-server/token"


def _basic_auth_header(client_id: str, client_secret: str) -> str:
    return "Basic " + base64.b64encode(f"{client_id}:{client_secret}".encode()).decode("ascii")


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


def generate_pkce_code_verifier() -> str:
    return secrets.token_urlsafe(96)


def generate_pkce_code_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


class MissingPipelineStateError(Exception):
    """Raised when required OAuth state is not found in the pipeline."""

    pass


class DatadogDCRView:
    """Dynamic Client Registration (RFC 7591) for Datadog MCP.

    Registers a new OAuth client with the MCP server and stores the resulting
    client_id / client_secret in pipeline state for subsequent views.
    """

    def __init__(self, register_url: str) -> None:
        self.register_url = register_url

    def dispatch(self, request: HttpRequest, pipeline: IdentityPipeline) -> HttpResponseBase:
        if pipeline.fetch_state("dcr_client_id"):
            return pipeline.next_step()

        redirect_uri = absolute_uri(_redirect_url(pipeline))

        resp = safe_urlopen(
            self.register_url,
            json={
                "client_name": "sentry",
                "redirect_uris": [redirect_uri],
                "grant_types": ["authorization_code", "refresh_token"],
                "token_endpoint_auth_method": "client_secret_basic",
            },
        )
        resp.raise_for_status()
        data = orjson.loads(safe_urlread(resp))

        pipeline.bind_state("dcr_client_id", data["client_id"])
        pipeline.bind_state("dcr_client_secret", data["client_secret"])

        return pipeline.next_step()


class DatadogOAuth2LoginView(OAuth2LoginView):
    """OAuth2 login with PKCE (RFC 7636) for Datadog MCP.

    Reads client_id from pipeline state (set by DatadogDCRView) and adds
    code_challenge, code_challenge_method, and resource to the authorize URL.
    """

    _code_verifier: str | None = None

    def __init__(self, authorize_url: str, scope: str, resource: str) -> None:
        super().__init__(authorize_url=authorize_url, scope=scope)
        self.resource = resource

    def dispatch(self, request: HttpRequest, pipeline: IdentityPipeline) -> HttpResponseBase:
        self.client_id = pipeline.fetch_state("dcr_client_id")

        # Ensure a code verifier exists and is bound to the pipeline.
        if existing := pipeline.fetch_state("pkce_code_verifier"):
            self._code_verifier = existing
        else:
            self._code_verifier = generate_pkce_code_verifier()
            pipeline.bind_state("pkce_code_verifier", self._code_verifier)

        return super().dispatch(request, pipeline)

    def get_authorize_params(self, state: str, redirect_uri: str) -> dict[str, str | None]:
        params = super().get_authorize_params(state, redirect_uri)

        params["resource"] = self.resource

        # Use the code verifier to generate the code challenge.
        assert self._code_verifier is not None
        params["code_challenge"] = generate_pkce_code_challenge(self._code_verifier)
        params["code_challenge_method"] = "S256"

        return params


class DatadogOAuth2CallbackView(OAuth2CallbackView):
    """OAuth2 callback with PKCE + client_secret_basic for Datadog MCP.

    Reads client_id / client_secret from pipeline state.
    Credentials are sent via Basic auth header, not in the POST body.
    """

    def exchange_token(
        self, request: HttpRequest, pipeline: IdentityPipeline, code: str
    ) -> dict[str, str]:
        try:
            return super().exchange_token(request, pipeline, code)
        except MissingPipelineStateError:
            # The MissingPipelineStateError is already recorded as a lifecycle failure by the
            # record_event context manager in super().exchange_token before propagating.
            return {
                "error": "Missing pipeline state",
                "error_description": "Could not authenticate due to missing pipeline state",
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
            raise MissingPipelineStateError("PKCE code_verifier missing from pipeline state")
        data["code_verifier"] = code_verifier

        # Include client id and secret in header.
        client_id = pipeline.fetch_state("dcr_client_id")
        client_secret = pipeline.fetch_state("dcr_client_secret")
        if not client_id or not client_secret:
            raise MissingPipelineStateError("DCR credentials missing from pipeline state")
        headers = {"Authorization": _basic_auth_header(client_id, client_secret)}

        verify_ssl = pipeline.config.get("verify_ssl", True)
        return safe_urlopen(
            self.access_token_url, data=data, headers=headers, verify_ssl=verify_ssl
        )


class DatadogIdentityProvider(OAuth2Provider):
    key = IntegrationProviderSlug.DATADOG
    name = "Datadog"

    oauth_scopes: tuple[str, ...] = ()

    def _get_mcp_base_url(self) -> str:
        return f"https://mcp.{self._get_oauth_parameter('site')}"

    def get_oauth_authorize_url(self) -> str:
        return self._get_mcp_base_url() + MCP_AUTHORIZE_PATH

    def get_oauth_access_token_url(self) -> str:
        return self._get_mcp_base_url() + MCP_TOKEN_PATH

    def get_pipeline_views(self) -> list[PipelineView[IdentityPipeline]]:
        return [
            DatadogDCRView(
                register_url=self._get_mcp_base_url() + MCP_REGISTER_PATH,
            ),
            DatadogOAuth2LoginView(
                authorize_url=self.get_oauth_authorize_url(),
                scope=" ".join(self.get_oauth_scopes()),
                resource=self._get_mcp_base_url(),
            ),
            DatadogOAuth2CallbackView(
                access_token_url=self.get_oauth_access_token_url(),
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

        user = get_user_info(access_token, self._get_oauth_parameter("site"))

        oauth_data = self.get_oauth_data(token_data)
        # Persist DCR credentials so refresh_identity can authenticate later.
        oauth_data["client_id"] = data.get("dcr_client_id")
        oauth_data["client_secret"] = data.get("dcr_client_secret")

        return {
            "type": IntegrationProviderSlug.DATADOG,
            "id": user["id"],
            "email": user.get("attributes", {}).get("email"),
            "name": user.get("attributes", {}).get("name"),
            "scopes": [],
            "data": oauth_data,
        }

    def get_refresh_token_url(self) -> str:
        return self.get_oauth_access_token_url()

    def get_refresh_token_params(
        self, refresh_token: str, identity: Identity | RpcIdentity, **kwargs: Any
    ) -> dict[str, str | None]:
        return {"grant_type": "refresh_token", "refresh_token": refresh_token}

    def get_refresh_token(
        self, refresh_token: str, url: str, identity: Identity | RpcIdentity, **kwargs: Any
    ) -> Response:
        data = self.get_refresh_token_params(refresh_token, identity, **kwargs)

        client_id = identity.data.get("client_id")
        client_secret = identity.data.get("client_secret")
        if not client_id or not client_secret:
            raise IdentityNotValid("Missing DCR credentials")
        headers = {"Authorization": _basic_auth_header(client_id, client_secret)}

        try:
            req = safe_urlopen(
                url=url,
                headers=headers,
                data=data,
                verify_ssl=kwargs.get("verify_ssl", True),
            )
            req.raise_for_status()
        except HTTPError as e:
            error_resp = e.response
            exc = ApiError.from_response(error_resp, url=url)
            if isinstance(exc, ApiUnauthorized | ApiInvalidRequestError):
                raise IdentityNotValid from e
            raise exc from e

        return req
