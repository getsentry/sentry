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

import orjson
from django.core.cache import cache
from jwt import ExpiredSignatureError, PyJWTError

from sentry import options
from sentry.http import safe_urlopen
from sentry.utils import jwt

logger = logging.getLogger("sentry.integrations.jira.forge")

FORGE_JWKS_URL = "https://forge.cdn.prod.atlassian-dev.net/.well-known/jwks.json"
FORGE_INVOCATION_TOKEN_ISSUER = "forge/invocation-token"

_JWKS_CACHE_KEY = "jira-forge:jwks"
_JWKS_CACHE_SECONDS = 60 * 60
_JWKS_REFRESH_LOCK_KEY = "jira-forge:jwks:refreshed"
# Tokens name their key, so this stops tokens with made-up key ids from forcing a
# fetch on every request.
_JWKS_MIN_REFRESH_SECONDS = 60
_JWKS_FETCH_TIMEOUT = 5


class ForgeInvocationTokenError(Exception):
    pass


@dataclass(frozen=True)
class ForgeInvocation:
    """The verified claims of a FIT that we act on."""

    app_id: str
    # Stable across app upgrades, but changes if the app is uninstalled and reinstalled.
    installation_id: str
    # Where Atlassian API calls for this installation go, e.g.
    # `https://api.atlassian.com/ex/jira/<cloudId>`. Not the site URL.
    api_base_url: str
    cloud_id: str | None
    environment_type: str | None
    module_key: str | None
    # The invoking user's account ID. Only present for calls from UI modules.
    principal: str | None


def _fetch_public_keys() -> dict[str, str]:
    response = safe_urlopen(FORGE_JWKS_URL, method="GET", timeout=_JWKS_FETCH_TIMEOUT)
    response.raise_for_status()
    keys: dict[str, str] = {}
    for jwk in response.json().get("keys", []):
        if jwk.get("kty") == "RSA" and isinstance(jwk.get("kid"), str):
            keys[jwk["kid"]] = jwt.rsa_key_from_jwk(orjson.dumps(jwk).decode())
    return keys


def _public_key_for(kid: str) -> str:
    keys: dict[str, str] | None = cache.get(_JWKS_CACHE_KEY)
    # Atlassian rotates keys, so an unknown kid triggers a refresh, at most once a minute.
    if keys is None or (
        kid not in keys and cache.add(_JWKS_REFRESH_LOCK_KEY, True, _JWKS_MIN_REFRESH_SECONDS)
    ):
        try:
            keys = _fetch_public_keys()
        except Exception as e:
            logger.warning("jira.forge.jwks_fetch_failed", exc_info=True)
            raise ForgeInvocationTokenError("Unable to fetch Forge signing keys") from e
        cache.set(_JWKS_CACHE_KEY, keys, _JWKS_CACHE_SECONDS)

    key = keys.get(kid)
    if key is None:
        raise ForgeInvocationTokenError("Unknown signing key")
    return key


def _cloud_id(claims: Mapping[str, Any]) -> str | None:
    context = claims.get("context") or {}
    if context.get("cloudId"):
        return context["cloudId"]
    for installation_context in claims["app"].get("installation", {}).get("contexts", []):
        if installation_context.get("cloudId"):
            return installation_context["cloudId"]
    return None


def verify_forge_invocation_token(token: str) -> ForgeInvocation:
    """Verify a FIT and return its claims, or raise ForgeInvocationTokenError."""
    try:
        header = jwt.peek_header(token)
        unverified = jwt.peek_claims(token)
    except jwt.DecodeError as e:
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

    try:
        claims = jwt.decode(token, _public_key_for(kid), audience=audience, algorithms=["RS256"])
    except ExpiredSignatureError as e:
        raise ForgeInvocationTokenError("Token is expired") from e
    except PyJWTError as e:
        raise ForgeInvocationTokenError("Invalid token") from e

    if claims.get("iss") != FORGE_INVOCATION_TOKEN_ISSUER:
        raise ForgeInvocationTokenError("Invalid issuer")

    app = claims.get("app") or {}
    if app.get("id") != audience or not app.get("installationId") or not app.get("apiBaseUrl"):
        raise ForgeInvocationTokenError("Missing app claims")

    return ForgeInvocation(
        app_id=app["id"],
        installation_id=app["installationId"],
        api_base_url=app["apiBaseUrl"],
        cloud_id=_cloud_id(claims),
        environment_type=(app.get("environment") or {}).get("type"),
        module_key=(app.get("module") or {}).get("key"),
        principal=claims.get("principal"),
    )
