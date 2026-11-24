"""Verification of Forge Invocation Tokens (FITs).

Every request a Forge app sends to a remote backend carries a FIT in its
`Authorization: Bearer` header: an RS256 JWT signed by Atlassian that names the
app, the installation and the site it was sent for.

https://developer.atlassian.com/platform/forge/remote/essentials/
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import orjson
from django.core.cache import cache
from django.http import HttpRequest
from jwt import ExpiredSignatureError, PyJWTError

from sentry import options
from sentry.integrations.client import ApiClient
from sentry.utils import jwt

logger = logging.getLogger("sentry.integrations.jira.forge")

FORGE_INVOCATION_TOKEN_ISSUER = "forge/invocation-token"
JIRA_API_BASE_URL = "https://api.atlassian.com/ex/jira/"

# Atlassian signs the FITs of every Forge app with one shared key set, published as a
# JWKS. The key alone doesn't prove a token is for us; the audience check does.
_SIGNING_KEYS_CACHE_KEY = "jira-forge:signing-keys"
_SIGNING_KEYS_CACHE_SECONDS = 60 * 60
_SIGNING_KEYS_REFRESH_LOCK_KEY = "jira-forge:signing-keys:refreshed"
# Tokens name their key, so this stops tokens with made-up key ids from forcing a
# fetch on every request.
_SIGNING_KEYS_MIN_REFRESH_SECONDS = 60


class ForgeInvocationTokenError(Exception):
    pass


class ForgeSigningKeysUnavailableError(ForgeInvocationTokenError):
    """The token couldn't be checked, rather than being invalid."""


@dataclass(frozen=True)
class ForgeInvocation:
    """The verified claims of a FIT that we act on."""

    app_id: str
    # Stable across app upgrades, but changes if the app is uninstalled and reinstalled.
    installation_id: str
    # Where Atlassian API calls for this installation go, e.g.
    # `https://api.atlassian.com/ex/jira/<cloudId>`. Not the site URL.
    api_base_url: str
    # The Atlassian site the call was made for. Not set on every invocation.
    cloud_id: str | None
    # PRODUCTION, STAGING or DEVELOPMENT; tells a dev install apart from the real app.
    environment_type: str | None
    # The manifest module that made the call, e.g. the event trigger or UI module key.
    module_key: str | None
    # The invoking user's account ID. Only present for calls from UI modules.
    principal: str | None


class ForgeSigningKeysClient(ApiClient):
    integration_name = "jira_forge"
    base_url = "https://forge.cdn.prod.atlassian-dev.net"
    timeout = 5

    def get_jwks(self) -> Mapping[str, Any]:
        return self.get("/.well-known/jwks.json")


def _fetch_forge_signing_keys() -> dict[str, str]:
    """Fetch the Forge JWKS and return its RSA public keys (PEM) by key id."""
    keys: dict[str, str] = {}
    for jwk in ForgeSigningKeysClient().get_jwks().get("keys", []):
        if jwk.get("kty") == "RSA" and isinstance(jwk.get("kid"), str):
            keys[jwk["kid"]] = jwt.rsa_key_from_jwk(orjson.dumps(jwk).decode())
    return keys


def _get_forge_signing_key(kid: str) -> str:
    """Return the public key a FIT names in its header, from the cached Forge key set."""
    keys: dict[str, str] | None = cache.get(_SIGNING_KEYS_CACHE_KEY)
    # Atlassian rotates keys, so an unknown kid triggers a refresh, at most once a minute.
    if keys is None or (
        kid not in keys
        and cache.add(_SIGNING_KEYS_REFRESH_LOCK_KEY, True, _SIGNING_KEYS_MIN_REFRESH_SECONDS)
    ):
        try:
            keys = _fetch_forge_signing_keys()
        except Exception as e:
            logger.warning("jira.forge.signing_keys_fetch_failed", exc_info=True)
            raise ForgeSigningKeysUnavailableError("Unable to fetch Forge signing keys") from e
        cache.set(_SIGNING_KEYS_CACHE_KEY, keys, _SIGNING_KEYS_CACHE_SECONDS)

    key = keys.get(kid)
    if key is None:
        raise ForgeInvocationTokenError("Unknown signing key")
    return key


def verify_forge_invocation_token(token: str) -> ForgeInvocation:
    """Verify a FIT and return its claims, or raise ForgeInvocationTokenError."""
    # 1. Read the unverified header and claims to decide whether to trust the token at all.
    try:
        header = jwt.peek_header(token)
        unverified = jwt.peek_claims(token)
    except PyJWTError as e:
        raise ForgeInvocationTokenError("Malformed token") from e

    if unverified.get("icLabel"):
        # Isolated Cloud tokens are signed by a different, per-tenant key set.
        raise ForgeInvocationTokenError("Isolated Cloud is not supported")

    # The audience is checked against our own list before trusting anything else.
    audience = unverified.get("aud")
    if not isinstance(audience, str) or audience not in options.get("jira.forge.app-ids"):
        raise ForgeInvocationTokenError("Token is not for a trusted app")

    kid = header.get("kid")
    if not isinstance(kid, str):
        raise ForgeInvocationTokenError("Missing key id")

    # 2. Verify the signature with the Forge signing key the header names.
    try:
        claims = jwt.decode(
            token, _get_forge_signing_key(kid), audience=audience, algorithms=["RS256"]
        )
    except ExpiredSignatureError as e:
        raise ForgeInvocationTokenError("Token is expired") from e
    except PyJWTError as e:
        raise ForgeInvocationTokenError("Invalid token") from e

    # 3. Check the now-verified claims.
    if claims.get("iss") != FORGE_INVOCATION_TOKEN_ISSUER:
        raise ForgeInvocationTokenError("Invalid issuer")

    app = claims.get("app") or {}
    if app.get("id") != audience or not app.get("installationId") or not app.get("apiBaseUrl"):
        raise ForgeInvocationTokenError("Missing app claims")

    return ForgeInvocation(
        app_id=app["id"],
        installation_id=app["installationId"],
        api_base_url=app["apiBaseUrl"],
        cloud_id=(claims.get("context") or {}).get("cloudId"),
        environment_type=(app.get("environment") or {}).get("type"),
        module_key=(app.get("module") or {}).get("key"),
        principal=claims.get("principal"),
    )


def verify_forge_request(request: HttpRequest) -> ForgeInvocation:
    """Verify the FIT in a request's `Authorization: Bearer` header."""
    scheme, _, token = request.headers.get("Authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise ForgeInvocationTokenError("Missing Forge invocation token")
    return verify_forge_invocation_token(token)


def jira_cloud_id(invocation: ForgeInvocation) -> str | None:
    """The cloudId of the single Jira site a FIT was sent for, or None.

    Backend invocations such as lifecycle events and scheduled triggers can have an
    empty `context`, so the site comes from apiBaseUrl, which every FIT carries. A
    `context.cloudId` that disagrees with it is rejected.
    """
    return _cloud_id(invocation.api_base_url, invocation.cloud_id)


def jira_cloud_id_from_claims(claims: Mapping[str, Any]) -> str | None:
    """`jira_cloud_id` for the claims of a FIT that was already verified elsewhere."""
    api_base_url = (claims.get("app") or {}).get("apiBaseUrl")
    if not isinstance(api_base_url, str):
        return None
    return _cloud_id(api_base_url, (claims.get("context") or {}).get("cloudId"))


def _cloud_id(api_base_url: str, context_cloud_id: str | None) -> str | None:
    try:
        cloud_id = str(UUID(api_base_url.removeprefix(JIRA_API_BASE_URL)))
    except ValueError:
        return None
    if api_base_url != f"{JIRA_API_BASE_URL}{cloud_id}":
        return None
    if context_cloud_id not in (None, cloud_id):
        return None
    return cloud_id
