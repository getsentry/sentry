from __future__ import annotations

import base64
import hashlib
import secrets
from typing import TYPE_CHECKING, Any, NotRequired, TypedDict

import orjson
import sentry_sdk
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from requests import ConnectionError, HTTPError, Response
from requests.exceptions import SSLError

from sentry.auth.exceptions import IdentityNotValid
from sentry.http import safe_urlopen, safe_urlread
from sentry.identity.base import Provider
from sentry.identity.mcp import McpIdentityProvider
from sentry.identity.oauth2 import (
    OAuth2CallbackView,
    OAuth2LoginView,
    OAuth2Provider,
    _redirect_url,
    record_event,
)
from sentry.identity.services.identity.model import RpcIdentity
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.utils.metrics import IntegrationPipelineViewType
from sentry.pipeline.views.base import PipelineView
from sentry.users.models.identity import Identity
from sentry.utils.http import absolute_uri

if TYPE_CHECKING:
    from sentry.identity.pipeline import IdentityPipeline

DATADOG_VALID_SITES: dict[str, str] = {
    "datadoghq.com": "US1",
    "us3.datadoghq.com": "US3",
    "us5.datadoghq.com": "US5",
    "datadoghq.eu": "EU",
    "ap1.datadoghq.com": "AP1",
    "ap2.datadoghq.com": "AP2",
    "ddog-gov.com": "US1-FED",
    "us2.ddog-gov.com": "US2-FED",
}

MCP_REGISTER_PATH = "/api/unstable/mcp-server/register"
MCP_AUTHORIZE_PATH = "/api/unstable/mcp-server/authorize"
MCP_TOKEN_PATH = "/api/unstable/mcp-server/token"
MCP_ENDPOINT_PATH = "/api/unstable/mcp-server/mcp"


def mcp_base_url_for_site(site: str | None) -> str | None:
    """Validated Datadog MCP base URL for a site, or None if it's missing/invalid."""
    if not site or site not in DATADOG_VALID_SITES:
        return None
    return f"https://mcp.{site}"


def _basic_auth_header(client_id: str, client_secret: str) -> str:
    return "Basic " + base64.b64encode(f"{client_id}:{client_secret}".encode()).decode("ascii")


class DatadogWhoami(TypedDict):
    user_uuid: str
    org_uuid: str
    user_email: NotRequired[str]
    user_name: NotRequired[str]


def mcp_whoami(mcp_base_url: str, auth_headers: dict[str, str]) -> DatadogWhoami:
    """Fetch the current Datadog user via the MCP ``datadog://mcp/whoami`` resource."""
    url = f"{mcp_base_url}{MCP_ENDPOINT_PATH}"
    headers = {**auth_headers, "Content-Type": "application/json"}

    init_resp = safe_urlopen(
        url,
        method="POST",
        headers=headers,
        json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
    )
    init_resp.raise_for_status()
    try:
        headers["Mcp-Session-Id"] = init_resp.headers["mcp-session-id"]
    except KeyError as e:
        sentry_sdk.capture_message("Datadog MCP initialize response missing session id")
        raise IdentityNotValid("MCP initialize response missing session id") from e

    resp = safe_urlopen(
        url,
        method="POST",
        headers=headers,
        json={
            "jsonrpc": "2.0",
            "id": 2,
            "method": "resources/read",
            "params": {"uri": "datadog://mcp/whoami"},
        },
    )
    resp.raise_for_status()

    try:
        body = orjson.loads(safe_urlread(resp))
        return orjson.loads(body["result"]["contents"][0]["text"])
    except (KeyError, IndexError, orjson.JSONDecodeError) as e:
        raise IdentityNotValid("MCP whoami returned an unexpected response") from e


def get_user_info(access_token: str, mcp_base_url: str) -> DatadogWhoami:
    """Fetch the current Datadog user via MCP whoami, authenticating with a Bearer token."""
    return mcp_whoami(mcp_base_url, {"Authorization": f"Bearer {access_token}"})


def generate_pkce_code_verifier() -> str:
    return secrets.token_urlsafe(96)


def generate_pkce_code_challenge(code_verifier: str) -> str:
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


class MissingPipelineStateError(Exception):
    """Raised when required OAuth state is not found in the pipeline."""

    pass


class DatadogOAuth2DCRView:
    """Dynamic Client Registration for Datadog MCP.

    Registers a new OAuth client with the MCP server and stores the resulting
    client_id and client_secret in pipeline state.
    """

    def __init__(self, register_url: str) -> None:
        self.register_url = register_url

    def dispatch(self, request: HttpRequest, pipeline: IdentityPipeline) -> HttpResponseBase:
        if pipeline.fetch_state("dcr_client_id") and pipeline.fetch_state("dcr_client_secret"):
            return pipeline.next_step()

        # Reuse DCR credentials from an existing identity if possible.
        if pipeline.provider_model and request.user.is_authenticated:
            try:
                existing_identity = Identity.objects.get(
                    idp=pipeline.provider_model, user=request.user
                )
                client_id = existing_identity.data.get("client_id")
                client_secret = existing_identity.data.get("client_secret")
                if client_id and client_secret:
                    pipeline.bind_state("dcr_client_id", client_id)
                    pipeline.bind_state("dcr_client_secret", client_secret)
                    return pipeline.next_step()
            except Identity.DoesNotExist:
                pass

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
    """OAuth2 login with PKCE for Datadog MCP.

    Reads client_id from pipeline state and adds code_challenge,
    code_challenge_method, and resource to the authorize URL.
    """

    def __init__(self, authorize_url: str, scope: str, resource: str) -> None:
        super().__init__(authorize_url=authorize_url, scope=scope)
        self.resource = resource
        self._code_verifier: str | None = None

    def dispatch(self, request: HttpRequest, pipeline: IdentityPipeline) -> HttpResponseBase:
        self.client_id = pipeline.fetch_state("dcr_client_id")

        # dispatch is called twice: once for the initial redirect and again
        # on the OAuth callback (code/error/state in GET). Only generate
        # a new verifier on the first pass.
        if not any(p in request.GET for p in ("code", "error", "state")):
            self._code_verifier = generate_pkce_code_verifier()
            pipeline.bind_state("pkce_code_verifier", self._code_verifier)

        return super().dispatch(request, pipeline)

    def get_authorize_params(self, state: str, redirect_uri: str) -> dict[str, str | None]:
        params = super().get_authorize_params(state, redirect_uri)

        params["resource"] = self.resource

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

        code_verifier = pipeline.fetch_state("pkce_code_verifier")
        if not code_verifier:
            raise MissingPipelineStateError("PKCE code_verifier missing from pipeline state")
        data["code_verifier"] = code_verifier

        client_id = pipeline.fetch_state("dcr_client_id")
        client_secret = pipeline.fetch_state("dcr_client_secret")
        if not client_id or not client_secret:
            raise MissingPipelineStateError("DCR credentials missing from pipeline state")
        headers = {"Authorization": _basic_auth_header(client_id, client_secret)}

        verify_ssl = pipeline.config.get("verify_ssl", True)
        return safe_urlopen(
            self.access_token_url, data=data, headers=headers, verify_ssl=verify_ssl
        )


class DatadogIdentityProvider(McpIdentityProvider, OAuth2Provider):
    key = IntegrationProviderSlug.DATADOG
    name = "Datadog"
    auto_create_provider_model = True
    create_organization_identity = True

    oauth_scopes: tuple[str, ...] = (
        "mcp_read",
        "apm_read",
        "error_tracking_read",
        "events_read",
        "hosts_read",
        "incident_read",
        "logs_read_data",
        "metrics_read",
        "monitors_read",
    )

    def get_pipeline_config(self, data: dict[str, Any]) -> dict[str, str]:
        site = data.get("site")
        if not site:
            raise ValueError("Datadog requires a 'site' parameter (e.g. 'datadoghq.com').")
        elif site not in DATADOG_VALID_SITES:
            raise ValueError(f"Invalid Datadog site: {site}")
        return {"site": site}

    def _build_mcp_base_url(self) -> str:
        """MCP base URL for this provider's configured site. Raises if invalid."""
        site = self._get_oauth_parameter("site")
        base = mcp_base_url_for_site(site)
        if base is None:
            raise ValueError(f"Invalid Datadog site: {site}")
        return base

    def build_mcp_urls(self, identity_data: dict[str, Any]) -> list[str]:
        base = mcp_base_url_for_site(identity_data.get("site"))
        return [f"{base}{MCP_ENDPOINT_PATH}"] if base else []

    def get_oauth_authorize_url(self) -> str:
        return self._build_mcp_base_url() + MCP_AUTHORIZE_PATH

    def get_oauth_access_token_url(self) -> str:
        return self._build_mcp_base_url() + MCP_TOKEN_PATH

    def get_pipeline_views(self) -> list[PipelineView[IdentityPipeline]]:
        return [
            DatadogOAuth2DCRView(
                register_url=self._build_mcp_base_url() + MCP_REGISTER_PATH,
            ),
            DatadogOAuth2LoginView(
                authorize_url=self.get_oauth_authorize_url(),
                scope=" ".join(self.get_oauth_scopes()),
                resource=self._build_mcp_base_url(),
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

        user = get_user_info(access_token, self._build_mcp_base_url())
        if "user_uuid" not in user or "org_uuid" not in user:
            raise IdentityNotValid(
                "User info response missing required fields (user_uuid, org_uuid)"
            )

        site = self._get_oauth_parameter("site")
        oauth_data = self.get_oauth_data(token_data)

        # Persist DCR credentials and site so refresh_identity can access them outside a pipeline context.
        client_id = data.get("dcr_client_id")
        client_secret = data.get("dcr_client_secret")
        if not client_id or not client_secret:
            raise IdentityNotValid("Missing DCR credentials")
        oauth_data["client_id"] = client_id
        oauth_data["client_secret"] = client_secret
        oauth_data["site"] = site

        return {
            "type": IntegrationProviderSlug.DATADOG,
            "id": user["user_uuid"],
            "idp_external_id": user["org_uuid"],
            "idp_config": {"site": site},
            "email": user.get("user_email"),
            "name": user.get("user_name"),
            "scopes": [],
            "data": oauth_data,
        }

    def get_refresh_token_url(self) -> str:
        return self.get_oauth_access_token_url()

    def get_refresh_token_headers(self) -> dict[str, str]:
        client_id = self.config.get("client_id")
        client_secret = self.config.get("client_secret")

        if not client_id or not client_secret:
            raise IdentityNotValid("Missing DCR credentials")

        return {"Authorization": _basic_auth_header(client_id, client_secret)}

    def get_refresh_token_params(
        self, refresh_token: str, identity: Identity | RpcIdentity, **kwargs: Any
    ) -> dict[str, str | None]:
        return {"grant_type": "refresh_token", "refresh_token": refresh_token}

    def refresh_identity(self, identity: Identity | RpcIdentity, **kwargs: Any) -> None:
        # Add site and client credentials to config so get_refresh_token_headers
        # and get_refresh_token_url can access them.

        site = identity.data.get("site")
        if not site:
            raise IdentityNotValid("Missing Datadog site")
        elif site not in DATADOG_VALID_SITES:
            raise IdentityNotValid(f"Invalid Datadog site: {site}")
        self.config["site"] = site

        client_id = identity.data.get("client_id")
        client_secret = identity.data.get("client_secret")
        if not client_id or not client_secret:
            raise IdentityNotValid("Missing DCR credentials")
        self.config["client_id"] = client_id
        self.config["client_secret"] = client_secret

        super().refresh_identity(identity, **kwargs)


class DatadogPatIdentityProvider(McpIdentityProvider, Provider):
    """Datadog identity backed by a user-supplied read-only personal access token.

    An alternative to the OAuth flow for environments where Datadog's MCP OAuth
    (loopback-only redirect URIs) cannot be used. The submitted token is used as
    a Bearer token against the MCP server, identical to an OAuth access token.
    """

    key = IntegrationProviderSlug.DATADOG_PAT
    name = "Datadog (Personal Access Token)"
    # A PAT connection is a variant of the datadog integration, so it shares its family
    # and a personal PAT suppresses the org-level datadog fallback.
    monitoring_family = IntegrationProviderSlug.DATADOG.value
    create_organization_identity = True

    def get_pipeline_views(self) -> list[PipelineView[IdentityPipeline]]:
        return []

    def build_mcp_urls(self, identity_data: dict[str, Any]) -> list[str]:
        base = mcp_base_url_for_site(identity_data.get("site"))
        return [f"{base}{MCP_ENDPOINT_PATH}"] if base else []

    def build_identity(self, data: dict[str, Any]) -> dict[str, Any]:
        access_token = (data.get("access_token") or "").strip()
        if not access_token:
            raise ValueError("Datadog requires an 'access_token' parameter.")

        site = data.get("site")
        base = mcp_base_url_for_site(site)
        if not site:
            raise ValueError("Datadog requires a 'site' parameter (e.g. 'datadoghq.com').")
        elif base is None:
            raise ValueError(f"Invalid Datadog site: {site}")

        user = get_user_info(access_token, base)
        if "user_uuid" not in user or "org_uuid" not in user:
            raise IdentityNotValid(
                "User info response missing required fields (user_uuid, org_uuid)"
            )

        return {
            "type": IntegrationProviderSlug.DATADOG_PAT,
            "id": user["user_uuid"],
            "idp_external_id": user["org_uuid"],
            "idp_config": {"site": site},
            "email": user.get("user_email"),
            "name": user.get("user_name"),
            "scopes": [],
            "data": {"access_token": access_token, "site": site},
        }
