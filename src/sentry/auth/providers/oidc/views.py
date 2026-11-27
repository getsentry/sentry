from __future__ import annotations

import base64
import hashlib
import logging
import secrets
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any
from urllib.parse import quote_plus, urlencode

from django.http import HttpRequest
from django.http.response import HttpResponseBase, HttpResponseRedirect
from requests.exceptions import RequestException

from sentry.auth.providers.oauth2 import OAuth2Callback, _get_redirect_url
from sentry.auth.services.auth.model import RpcAuthProvider
from sentry.auth.view import AuthView
from sentry.http import safe_urlopen
from sentry.identity.google.provider import normalize_email_verified
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.base.response import DeferredResponse

from .constants import (
    ERR_EMAIL_NOT_VERIFIED,
    ERR_INVALID_RESPONSE,
    ERR_NOT_CONFIGURED,
    HTTP_TIMEOUT,
    SCOPE,
)
from .discovery import DiscoveryError, build_provider_config, fetch_discovery_document
from .forms import OIDCSetupForm
from .id_token import IDTokenError, fetch_jwks, validate_id_token
from .secrets import decrypt_client_secret, encrypt_client_secret

if TYPE_CHECKING:
    from sentry.auth.helper import AuthHelper

logger = logging.getLogger("sentry.auth.oidc")


def get_provider_config(pipeline: AuthHelper) -> Mapping[str, Any] | None:
    # During setup the AuthProvider doesn't exist yet, so the config lives in pipeline state.
    return pipeline.provider.config or pipeline.fetch_state("oidc")


def pkce_challenge(code_verifier: str) -> str:
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


class ConfigureIdP(AuthView):
    """Setup step: collect the issuer and client credentials, then validate discovery."""

    def handle(self, request: HttpRequest, pipeline: AuthHelper) -> HttpResponseBase:
        if "action_save" not in request.POST:
            form = OIDCSetupForm()
        else:
            form = OIDCSetupForm(request.POST)
            if form.is_valid():
                issuer = form.cleaned_data["issuer"]
                try:
                    config = build_provider_config(
                        issuer,
                        fetch_discovery_document(issuer),
                        client_id=form.cleaned_data["client_id"],
                        client_secret=encrypt_client_secret(form.cleaned_data["client_secret"]),
                    )
                except DiscoveryError as e:
                    form.add_error(None, str(e))
                else:
                    pipeline.bind_state("oidc", config)
                    return pipeline.next_step()

        return self.respond(
            "sentry_auth_oidc/select-idp.html",
            {
                "form": form,
                "provider_key": pipeline.provider.key,
                "provider_name": pipeline.provider.name,
                "redirect_uri": _get_redirect_url(),
            },
        )


class OIDCLogin(AuthView):
    """Redirect to the provider with state, nonce and a PKCE (S256) challenge."""

    def dispatch(self, request: HttpRequest, pipeline: AuthHelper) -> HttpResponseBase:
        if "code" in request.GET or "error" in request.GET:
            return pipeline.next_step()

        config = get_provider_config(pipeline)
        if not config:
            return pipeline.error(ERR_NOT_CONFIGURED)

        # The provider key in state lets the callback detect a flow started for another
        # provider, like OAuth2Login does.
        state = f"{secrets.token_hex()}:{pipeline.provider.key}"
        nonce = secrets.token_urlsafe(32)
        code_verifier = secrets.token_urlsafe(64)

        pipeline.bind_state("state", state)
        pipeline.bind_state("nonce", nonce)
        pipeline.bind_state("code_verifier", code_verifier)
        if request.subdomain:
            pipeline.bind_state("subdomain", request.subdomain)

        params = {
            "client_id": config["client_id"],
            "response_type": "code",
            "scope": SCOPE,
            "state": state,
            "nonce": nonce,
            "redirect_uri": _get_redirect_url(),
            "code_challenge": pkce_challenge(code_verifier),
            "code_challenge_method": "S256",
        }
        endpoint = config["authorization_endpoint"]
        separator = "&" if "?" in endpoint else "?"
        return HttpResponseRedirect(f"{endpoint}{separator}{urlencode(params)}")


class OIDCCallback(OAuth2Callback):
    """Exchange the code with the PKCE verifier, authenticating with the configured method."""

    def exchange_token(
        self, request: HttpRequest, pipeline: AuthHelper, code: str
    ) -> Mapping[str, Any]:
        config = get_provider_config(pipeline)
        code_verifier = pipeline.fetch_state("code_verifier")
        if not config or not code_verifier:
            return {"error": "invalid_state"}

        client_id = config["client_id"]
        client_secret = decrypt_client_secret(config["client_secret"])
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": _get_redirect_url(),
            "code_verifier": code_verifier,
        }
        headers = {"Accept": "application/json"}
        if config["token_endpoint_auth_method"] == "client_secret_post":
            data.update(client_id=client_id, client_secret=client_secret)
        else:
            # RFC 6749 §2.3.1: form-encode each part before joining.
            credentials = f"{quote_plus(client_id)}:{quote_plus(client_secret)}"
            headers["Authorization"] = "Basic " + base64.b64encode(credentials.encode()).decode()

        try:
            response = safe_urlopen(
                config["token_endpoint"], data=data, headers=headers, timeout=HTTP_TIMEOUT
            )
            payload = response.json()
        except (RequestException, ValueError):
            return {"error": "invalid_response"}

        if not isinstance(payload, dict):
            return {"error": "invalid_response"}
        return payload


class ValidateIDToken(AuthView):
    """Verify the ID token against the provider's JWKS and bind the user's claims."""

    def dispatch(self, request: HttpRequest, pipeline: AuthHelper) -> HttpResponseBase:
        config = get_provider_config(pipeline)
        token_response = pipeline.fetch_state("data") or {}
        id_token = token_response.get("id_token")
        nonce = pipeline.fetch_state("nonce")
        if not config or not isinstance(id_token, str) or not nonce:
            return pipeline.error(ERR_INVALID_RESPONSE)

        error: IDTokenError | None = None
        try:
            claims = validate_id_token(
                id_token,
                jwks=fetch_jwks(config["jwks_uri"]),
                issuer=config["issuer"],
                client_id=config["client_id"],
                nonce=nonce,
                allowed_algorithms=config["id_token_signing_alg_values_supported"],
            )
        except IDTokenError as e:
            error = e

        if error is not None:
            logger.warning(
                "oidc.id_token.invalid",
                extra={
                    "reason": str(error),
                    "issuer": config["issuer"],
                    "organization_id": pipeline.organization.id,
                },
            )
            return pipeline.error(ERR_INVALID_RESPONSE)

        if not claims.get("email"):
            return pipeline.error(ERR_INVALID_RESPONSE)
        if not normalize_email_verified(claims.get("email_verified")):
            return pipeline.error(ERR_EMAIL_NOT_VERIFIED)

        pipeline.bind_state(
            "user", {k: claims[k] for k in ("iss", "sub", "email", "name") if k in claims}
        )
        return pipeline.next_step()


def oidc_configure_view(
    request: HttpRequest, organization: RpcOrganization, auth_provider: RpcAuthProvider
) -> DeferredResponse:
    config = auth_provider.config
    return DeferredResponse(
        "sentry_auth_oidc/configure.html",
        {
            "issuer": config.get("issuer"),
            "client_id": config.get("client_id"),
            "redirect_uri": _get_redirect_url(),
        },
    )
