from __future__ import annotations

from collections.abc import Collection
from typing import Any

import jwt as pyjwt
from django.utils.crypto import constant_time_compare
from requests.exceptions import RequestException

from sentry.http import safe_urlopen

from .constants import ALLOWED_SIGNING_ALGORITHMS, HTTP_TIMEOUT, ID_TOKEN_LEEWAY


class IDTokenError(Exception):
    """The ID token failed validation. The message is for logs, not for users."""


def fetch_jwks(jwks_uri: str) -> pyjwt.PyJWKSet:
    try:
        response = safe_urlopen(jwks_uri, timeout=HTTP_TIMEOUT)
    except RequestException as e:
        raise IDTokenError(f"could not fetch JWKS: {type(e).__name__}") from None
    if response.status_code != 200:
        raise IDTokenError(f"JWKS returned HTTP {response.status_code}")
    try:
        return pyjwt.PyJWKSet.from_dict(response.json())
    except (ValueError, pyjwt.PyJWKSetError) as e:
        raise IDTokenError(f"invalid JWKS: {e}") from None


def _select_key(jwks: pyjwt.PyJWKSet, kid: str | None) -> pyjwt.PyJWK:
    signing_keys = [
        k for k in jwks.keys if k.key_type in ("RSA", "EC") and k.public_key_use in (None, "sig")
    ]
    if kid is not None:
        for key in signing_keys:
            if key.key_id == kid:
                return key
        raise IDTokenError("no JWKS key matches the token's kid")
    if len(signing_keys) == 1:
        return signing_keys[0]
    raise IDTokenError("token has no kid and the JWKS has more than one signing key")


def validate_id_token(
    id_token: str,
    *,
    jwks: pyjwt.PyJWKSet,
    issuer: str,
    client_id: str,
    nonce: str,
    allowed_algorithms: Collection[str],
) -> dict[str, Any]:
    """Validate an ID token per OpenID Connect Core 1.0 §3.1.3.7 and return its claims."""
    try:
        header = pyjwt.get_unverified_header(id_token)
    except pyjwt.DecodeError as e:
        raise IDTokenError(f"malformed token: {e}") from None

    alg = header.get("alg")
    if alg not in ALLOWED_SIGNING_ALGORITHMS or alg not in allowed_algorithms:
        raise IDTokenError(f"unexpected signing algorithm {alg!r}")

    key = _select_key(jwks, header.get("kid"))

    try:
        claims: dict[str, Any] = pyjwt.decode(
            id_token,
            key=key.key,
            algorithms=[alg],
            audience=client_id,
            issuer=issuer,
            leeway=ID_TOKEN_LEEWAY,
            options={"require": ["iss", "sub", "aud", "exp", "iat"]},
        )
    except pyjwt.PyJWTError as e:
        raise IDTokenError(f"{type(e).__name__}: {e}") from None

    # §3.1.3.7 steps 4-5: with several audiences, azp must be us.
    aud = claims["aud"]
    azp = claims.get("azp")
    if (isinstance(aud, list) and len(aud) > 1 and azp is None) or (
        azp is not None and azp != client_id
    ):
        raise IDTokenError("authorized party does not match the client ID")

    token_nonce = claims.get("nonce")
    if not isinstance(token_nonce, str) or not constant_time_compare(token_nonce, nonce):
        raise IDTokenError("nonce mismatch")

    if not isinstance(claims["sub"], str) or not claims["sub"]:
        raise IDTokenError("missing sub")

    return claims
