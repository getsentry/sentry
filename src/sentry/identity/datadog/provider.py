from __future__ import annotations

import base64
import hashlib
import secrets

import orjson
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from requests import ConnectionError, HTTPError, Response
from requests.exceptions import SSLError

from sentry.http import safe_urlopen, safe_urlread
from sentry.identity.oauth2 import (
    OAuth2CallbackView,
    OAuth2LoginView,
    _redirect_url,
    record_event,
)
from sentry.identity.pipeline import IdentityPipeline
from sentry.integrations.utils.metrics import IntegrationPipelineViewType
from sentry.utils.http import absolute_uri


def _basic_auth_header(client_id: str, client_secret: str) -> str:
    return "Basic " + base64.b64encode(f"{client_id}:{client_secret}".encode()).decode("ascii")


def generate_pkce_code_verifier() -> str:
    return secrets.token_urlsafe(96)


def generate_pkce_code_challenge(code_verifier: str) -> str:
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


class MissingPipelineStateError(Exception):
    """Raised when required OAuth state is not found in the pipeline."""

    pass


class DatadogDCRView:
    """Dynamic Client Registration (RFC 7591) for Datadog MCP.

    Registers a new OAuth client with the MCP server and stores the resulting
    client_id and client_secret in pipeline state.
    """

    def __init__(self, register_url: str) -> None:
        self.register_url = register_url

    def dispatch(self, request: HttpRequest, pipeline: IdentityPipeline) -> HttpResponseBase:
        if pipeline.fetch_state("dcr_client_id") and pipeline.fetch_state("dcr_client_secret"):
            return pipeline.next_step()

        with record_event(
            IntegrationPipelineViewType.DCR_REGISTRATION, pipeline.provider.key
        ).capture() as lifecycle:
            redirect_uri = absolute_uri(_redirect_url(pipeline))

            try:
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
            except HTTPError as e:
                lifecycle.record_failure(e)
                return pipeline.error("DCR registration failed")
            except SSLError:
                lifecycle.record_failure("ssl_error")
                return pipeline.error("Could not verify SSL certificate")
            except ConnectionError:
                lifecycle.record_failure("connection_error")
                return pipeline.error("Could not connect to host or service")

            try:
                data = orjson.loads(safe_urlread(resp))
            except orjson.JSONDecodeError:
                lifecycle.record_failure("json_error")
                return pipeline.error("Could not decode a JSON Response")

            client_id = data.get("client_id")
            client_secret = data.get("client_secret")
            if not client_id or not client_secret:
                lifecycle.record_failure("missing_credentials")
                return pipeline.error("DCR response missing client credentials")

            pipeline.bind_state("dcr_client_id", client_id)
            pipeline.bind_state("dcr_client_secret", client_secret)

            return pipeline.next_step()


class DatadogOAuth2LoginView(OAuth2LoginView):
    """OAuth2 login with PKCE (RFC 7636) for Datadog MCP.

    Reads client_id from pipeline state and adds code_challenge,
    code_challenge_method, and resource to the authorize URL.
    """

    _code_verifier: str | None = None

    def __init__(self, authorize_url: str, scope: str, resource: str) -> None:
        super().__init__(authorize_url=authorize_url, scope=scope)
        self.resource = resource

    def dispatch(self, request: HttpRequest, pipeline: IdentityPipeline) -> HttpResponseBase:
        self.client_id = pipeline.fetch_state("dcr_client_id")

        # PKCE: Ensure a code verifier exists and is bound to the pipeline.
        if existing_code_verifier := pipeline.fetch_state("pkce_code_verifier"):
            self._code_verifier = existing_code_verifier
        else:
            self._code_verifier = generate_pkce_code_verifier()
            pipeline.bind_state("pkce_code_verifier", self._code_verifier)

        return super().dispatch(request, pipeline)

    def get_authorize_params(self, state: str, redirect_uri: str) -> dict[str, str | None]:
        params = super().get_authorize_params(state, redirect_uri)

        params["resource"] = self.resource

        # PKCE: Use the code verifier to generate the code challenge.
        assert self._code_verifier is not None
        params["code_challenge"] = generate_pkce_code_challenge(self._code_verifier)
        params["code_challenge_method"] = "S256"

        return params


class DatadogOAuth2CallbackView(OAuth2CallbackView):
    """OAuth2 callback with PKCE + client_secret_basic for Datadog MCP.

    Adds code verifier to the authorize URL. Reads client_id / client_secret
    from pipeline state and sends them via Basic auth header.
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

        # PKCE: Add code verifier to the token params.
        code_verifier = pipeline.fetch_state("pkce_code_verifier")
        if not code_verifier:
            raise MissingPipelineStateError("PKCE code_verifier missing from pipeline state")
        data["code_verifier"] = code_verifier

        # DCR: Include client id and secret in header.
        client_id = pipeline.fetch_state("dcr_client_id")
        client_secret = pipeline.fetch_state("dcr_client_secret")
        if not client_id or not client_secret:
            raise MissingPipelineStateError("DCR credentials missing from pipeline state")
        headers = {"Authorization": _basic_auth_header(client_id, client_secret)}

        verify_ssl = pipeline.config.get("verify_ssl", True)
        return safe_urlopen(
            self.access_token_url, data=data, headers=headers, verify_ssl=verify_ssl
        )
