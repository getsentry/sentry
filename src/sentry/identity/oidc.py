"""Verification of OpenID Connect ID tokens.

An ID token is a JWT the identity provider signs with a key from its published JWKS.
Its claims are only trustworthy once the signature, issuer, audience and lifetime
have been checked.

https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation
"""

from __future__ import annotations

import logging
from collections.abc import Collection
from typing import Any

import jwt as pyjwt
from django.core.cache import cache
from django.utils.crypto import constant_time_compare
from jwt import PyJWK, PyJWTError

from sentry.auth.exceptions import IdentityNotValid
from sentry.http import safe_urlopen
from sentry.utils.hashlib import md5_text

logger = logging.getLogger("sentry.identity.oidc")

# Asymmetric only: "none" skips the signature, and with an HMAC algorithm anyone who
# can read the published key material could sign tokens.
_ALLOWED_ALGORITHMS = (
    "RS256",
    "RS384",
    "RS512",
    "PS256",
    "PS384",
    "PS512",
    "ES256",
    "ES384",
    "ES512",
)

# Tolerated clock skew between us and the identity provider.
_LEEWAY_SECONDS = 60

_JWKS_FRESH_SECONDS = 60 * 60
# How long a key set stays usable after it stops being fresh, so that an outage of the
# provider's JWKS endpoint doesn't fail every login.
_JWKS_STALE_SECONDS = 24 * 60 * 60
# Tokens name their key, so this stops tokens with made-up key ids from forcing a
# fetch on every request.
_JWKS_MIN_REFRESH_SECONDS = 60
_JWKS_FETCH_TIMEOUT_SECONDS = 5


def _cache_key(jwks_uri: str, kind: str) -> str:
    return f"identity:oidc:jwks:{kind}:{md5_text(jwks_uri).hexdigest()}"


def _fetch_jwks(jwks_uri: str) -> list[dict[str, Any]]:
    """Fetch the provider's JWKS, or return nothing if that is not possible."""
    try:
        response = safe_urlopen(jwks_uri, method="GET", timeout=_JWKS_FETCH_TIMEOUT_SECONDS)
        response.raise_for_status()
        keys = response.json()["keys"]
    except Exception:
        logger.warning(
            "identity.oidc.jwks_fetch_failed", extra={"jwks_uri": jwks_uri}, exc_info=True
        )
        return []

    if not isinstance(keys, list):
        logger.warning("identity.oidc.jwks_malformed", extra={"jwks_uri": jwks_uri})
        return []
    return [key for key in keys if isinstance(key, dict)]


def _get_jwks(jwks_uri: str, *, force_refresh: bool = False) -> list[dict[str, Any]]:
    fresh_key = _cache_key(jwks_uri, "fresh")
    stale_key = _cache_key(jwks_uri, "stale")

    if not force_refresh:
        cached = cache.get(fresh_key)
        if cached is not None:
            return cached

    keys = _fetch_jwks(jwks_uri)
    if keys:
        cache.set(fresh_key, keys, _JWKS_FRESH_SECONDS)
        cache.set(stale_key, keys, _JWKS_FRESH_SECONDS + _JWKS_STALE_SECONDS)
        return keys

    stale = cache.get(stale_key)
    if stale is not None:
        logger.warning("identity.oidc.jwks_serving_stale", extra={"jwks_uri": jwks_uri})
        return stale

    raise IdentityNotValid("Unable to fetch the identity provider's signing keys")


def _select_key(keys: list[dict[str, Any]], kid: object) -> dict[str, Any] | None:
    signing_keys = [key for key in keys if key.get("use", "sig") == "sig"]
    if kid is None:
        # A token may omit its key id only when there is no doubt which key signed it.
        return signing_keys[0] if len(signing_keys) == 1 else None
    return next((key for key in signing_keys if key.get("kid") == kid), None)


def _get_signing_key(jwks_uri: str, kid: object) -> dict[str, Any]:
    jwk = _select_key(_get_jwks(jwks_uri), kid)
    # Providers rotate keys, so a token can name a key our cached set predates.
    if jwk is None and cache.add(
        _cache_key(jwks_uri, "refreshed"), True, _JWKS_MIN_REFRESH_SECONDS
    ):
        jwk = _select_key(_get_jwks(jwks_uri, force_refresh=True), kid)
    if jwk is None:
        raise IdentityNotValid("ID token is signed with an unknown key")
    return jwk


def verify_id_token(
    id_token: str,
    *,
    jwks_uri: str,
    issuers: Collection[str],
    audience: str,
    nonce: str | None = None,
) -> dict[str, Any]:
    """Verify an OpenID Connect ID token and return its claims.

    :param jwks_uri: Where the provider publishes the keys it signs ID tokens with.
    :param issuers: The accepted values of the ``iss`` claim.
    :param audience: Our OAuth client id, which must be the token's ``aud``.
    :param nonce: The nonce sent in the authorization request, if one was sent.
    :raises IdentityNotValid: If the token can't be verified, for any reason.
    """
    if not audience:
        raise IdentityNotValid("No client id to check the ID token audience against")

    try:
        header = pyjwt.get_unverified_header(id_token)
    except PyJWTError as e:
        raise IdentityNotValid("Malformed ID token") from e

    algorithm = header.get("alg")
    if algorithm not in _ALLOWED_ALGORITHMS:
        raise IdentityNotValid("ID token is signed with a disallowed algorithm")

    jwk = _get_signing_key(jwks_uri, header.get("kid"))
    if jwk.get("alg", algorithm) != algorithm:
        raise IdentityNotValid("ID token algorithm does not match its signing key")

    try:
        claims = pyjwt.decode(
            id_token,
            PyJWK(jwk, algorithm=algorithm),
            algorithms=[algorithm],
            audience=audience,
            issuer=issuers,
            leeway=_LEEWAY_SECONDS,
            options={"require": ["iss", "aud", "sub", "exp", "iat"]},
        )
    except PyJWTError as e:
        raise IdentityNotValid(f"Invalid ID token: {e}") from e

    # A token with several audiences, or issued to another client of the same
    # provider on our behalf, must name us as the party it was issued to.
    authorized_party = claims.get("azp")
    multiple_audiences = isinstance(claims["aud"], list) and len(claims["aud"]) > 1
    if (authorized_party is not None or multiple_audiences) and authorized_party != audience:
        raise IdentityNotValid("ID token was issued to a different client")

    if nonce is not None:
        token_nonce = claims.get("nonce")
        if not isinstance(token_nonce, str) or not constant_time_compare(token_nonce, nonce):
            raise IdentityNotValid("ID token nonce does not match")

    return claims
