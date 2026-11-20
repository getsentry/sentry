from __future__ import annotations

import time
from typing import Any

import jwt as pyjwt
import pytest
import responses

from sentry.auth.providers.oidc.id_token import IDTokenError, fetch_jwks, validate_id_token

from . import CLIENT_ID, ISSUER, FakeIdP

idp = FakeIdP()
NONCE = "expected-nonce"


def validate(token: str, **kwargs: Any) -> dict[str, Any]:
    params: dict[str, Any] = {
        "jwks": pyjwt.PyJWKSet.from_dict(idp.jwks()),
        "issuer": ISSUER,
        "client_id": CLIENT_ID,
        "nonce": NONCE,
        "allowed_algorithms": ["RS256"],
    }
    params.update(kwargs)
    return validate_id_token(token, **params)


def test_valid_token() -> None:
    claims = validate(idp.id_token(NONCE))
    assert claims["sub"] == "user-123"
    assert claims["email"] == "alice@example.com"


def test_bad_signature() -> None:
    with pytest.raises(IDTokenError, match="InvalidSignatureError"):
        validate(idp.id_token(NONCE, signing_key=idp.other_key))


def test_wrong_audience() -> None:
    with pytest.raises(IDTokenError, match="InvalidAudienceError"):
        validate(idp.id_token(NONCE, aud="someone-else"))


def test_wrong_issuer() -> None:
    with pytest.raises(IDTokenError, match="InvalidIssuerError"):
        validate(idp.id_token(NONCE, iss="https://evil.example.com"))


def test_expired() -> None:
    past = int(time.time()) - 3600
    with pytest.raises(IDTokenError, match="ExpiredSignatureError"):
        validate(idp.id_token(NONCE, iat=past - 300, exp=past))


def test_missing_iat() -> None:
    with pytest.raises(IDTokenError, match="MissingRequiredClaimError"):
        validate(idp.id_token(NONCE, iat=None))


@pytest.mark.parametrize("nonce", ["other-nonce", None])
def test_nonce_mismatch(nonce: str | None) -> None:
    with pytest.raises(IDTokenError, match="nonce"):
        validate(idp.id_token(nonce))  # type: ignore[arg-type]


def test_symmetric_algorithm_is_rejected() -> None:
    token = pyjwt.encode({"sub": "x"}, "secret-key-of-enough-length-1234", algorithm="HS256")
    with pytest.raises(IDTokenError, match="algorithm"):
        validate(token, allowed_algorithms=["RS256", "HS256"])


def test_algorithm_not_advertised_by_provider() -> None:
    with pytest.raises(IDTokenError, match="algorithm"):
        validate(idp.id_token(NONCE), allowed_algorithms=["ES256"])


def test_unknown_kid() -> None:
    with pytest.raises(IDTokenError, match="kid"):
        validate(idp.id_token(NONCE, headers={"kid": "rotated-away"}))


def test_multiple_audiences_require_matching_azp() -> None:
    with pytest.raises(IDTokenError, match="authorized party"):
        validate(idp.id_token(NONCE, aud=[CLIENT_ID, "other"]))
    with pytest.raises(IDTokenError, match="authorized party"):
        validate(idp.id_token(NONCE, aud=[CLIENT_ID, "other"], azp="other"))

    claims = validate(idp.id_token(NONCE, aud=[CLIENT_ID, "other"], azp=CLIENT_ID))
    assert claims["azp"] == CLIENT_ID


def test_malformed_token() -> None:
    with pytest.raises(IDTokenError, match="malformed"):
        validate("not-a-jwt")


@responses.activate
def test_fetch_jwks() -> None:
    idp.add_jwks()
    assert [k.key_id for k in fetch_jwks(f"{ISSUER}/jwks").keys] == ["key-1"]


@pytest.mark.parametrize("body", [[], {"keys": "nope"}, {"keys": ["nope"]}, {}, "nope"])
@responses.activate
def test_fetch_jwks_rejects_malformed_documents(body: object) -> None:
    responses.add(responses.GET, f"{ISSUER}/jwks", json=body)
    with pytest.raises(IDTokenError, match="list of keys"):
        fetch_jwks(f"{ISSUER}/jwks")


@responses.activate
def test_fetch_jwks_without_usable_keys() -> None:
    responses.add(responses.GET, f"{ISSUER}/jwks", json={"keys": [{"kty": "unknown"}]})
    with pytest.raises(IDTokenError, match="invalid JWKS"):
        fetch_jwks(f"{ISSUER}/jwks")


@responses.activate
def test_fetch_jwks_not_json() -> None:
    responses.add(responses.GET, f"{ISSUER}/jwks", body="<html>")
    with pytest.raises(IDTokenError, match="not JSON"):
        fetch_jwks(f"{ISSUER}/jwks")
