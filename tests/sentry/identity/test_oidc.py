from __future__ import annotations

import time
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt as pyjwt
import pytest
import responses
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from django.core.cache import cache
from jwt.algorithms import ECAlgorithm, RSAAlgorithm

from sentry.auth.exceptions import IdentityNotValid
from sentry.identity.oidc import verify_id_token
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time

JWKS_URI = "https://idp.example.com/jwks"
ISSUER = "https://idp.example.com"
CLIENT_ID = "client-id.example.com"


def _rsa_key() -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def _public_jwk(key: rsa.RSAPrivateKey, kid: str) -> dict[str, Any]:
    jwk = RSAAlgorithm.to_jwk(key.public_key(), as_dict=True)
    return {**jwk, "kid": kid, "alg": "RS256", "use": "sig"}


def _claims(**overrides: Any) -> dict[str, Any]:
    now = int(time.time())
    return {
        "iss": ISSUER,
        "aud": CLIENT_ID,
        "sub": "user-1234",
        "email": "user@example.com",
        "iat": now,
        "exp": now + 3600,
        **overrides,
    }


def _sign(key: Any, kid: str | None, claims: dict[str, Any], algorithm: str = "RS256") -> str:
    headers = {"kid": kid} if kid is not None else {}
    return pyjwt.encode(claims, key, algorithm=algorithm, headers=headers)


def _verify(token: str, **kwargs: Any) -> dict[str, Any]:
    return verify_id_token(
        token, jwks_uri=JWKS_URI, issuers=(ISSUER,), audience=CLIENT_ID, **kwargs
    )


class VerifyIdTokenTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        cache.clear()
        self.key = _rsa_key()

    def _serve_jwks(self, *jwks: dict[str, Any]) -> None:
        responses.add(responses.GET, JWKS_URI, json={"keys": list(jwks)})

    def _jwks_calls(self) -> int:
        return len([call for call in responses.calls if call.request.url == JWKS_URI])

    @responses.activate
    def test_valid_token(self) -> None:
        self._serve_jwks(_public_jwk(self.key, "key-1"))

        claims = _verify(_sign(self.key, "key-1", _claims()))

        assert claims["sub"] == "user-1234"
        assert claims["email"] == "user@example.com"

    @responses.activate
    def test_accepts_any_listed_issuer(self) -> None:
        self._serve_jwks(_public_jwk(self.key, "key-1"))
        token = _sign(self.key, "key-1", _claims(iss="idp.example.com"))

        claims = verify_id_token(
            token,
            jwks_uri=JWKS_URI,
            issuers=(ISSUER, "idp.example.com"),
            audience=CLIENT_ID,
        )

        assert claims["iss"] == "idp.example.com"

    @responses.activate
    def test_caches_jwks(self) -> None:
        self._serve_jwks(_public_jwk(self.key, "key-1"))

        _verify(_sign(self.key, "key-1", _claims()))
        _verify(_sign(self.key, "key-1", _claims()))

        assert self._jwks_calls() == 1

    @responses.activate
    def test_bad_signature(self) -> None:
        self._serve_jwks(_public_jwk(self.key, "key-1"))
        forged = _sign(_rsa_key(), "key-1", _claims())

        with pytest.raises(IdentityNotValid, match="Signature verification failed"):
            _verify(forged)

    @responses.activate
    def test_tampered_payload(self) -> None:
        self._serve_jwks(_public_jwk(self.key, "key-1"))
        header, _, signature = _sign(self.key, "key-1", _claims()).split(".")
        _, payload, _ = _sign(self.key, "key-1", _claims(sub="someone-else")).split(".")

        with pytest.raises(IdentityNotValid, match="Signature verification failed"):
            _verify(f"{header}.{payload}.{signature}")

    @responses.activate
    def test_wrong_audience(self) -> None:
        self._serve_jwks(_public_jwk(self.key, "key-1"))

        with pytest.raises(IdentityNotValid, match="Audience doesn't match"):
            _verify(_sign(self.key, "key-1", _claims(aud="another-client")))

    @responses.activate
    def test_multiple_audiences_require_matching_azp(self) -> None:
        self._serve_jwks(_public_jwk(self.key, "key-1"))
        token = _sign(self.key, "key-1", _claims(aud=[CLIENT_ID, "another-client"]))

        with pytest.raises(IdentityNotValid, match="different client"):
            _verify(token)

    @responses.activate
    def test_azp_for_another_client(self) -> None:
        self._serve_jwks(_public_jwk(self.key, "key-1"))
        token = _sign(self.key, "key-1", _claims(azp="another-client"))

        with pytest.raises(IdentityNotValid, match="different client"):
            _verify(token)

    @responses.activate
    def test_wrong_issuer(self) -> None:
        self._serve_jwks(_public_jwk(self.key, "key-1"))

        with pytest.raises(IdentityNotValid, match="Invalid issuer"):
            _verify(_sign(self.key, "key-1", _claims(iss="https://evil.example.com")))

    @responses.activate
    def test_expired(self) -> None:
        self._serve_jwks(_public_jwk(self.key, "key-1"))
        now = int(time.time())
        token = _sign(self.key, "key-1", _claims(iat=now - 7200, exp=now - 3600))

        with pytest.raises(IdentityNotValid, match="Signature has expired"):
            _verify(token)

    @responses.activate
    def test_expiry_within_leeway(self) -> None:
        self._serve_jwks(_public_jwk(self.key, "key-1"))
        now = int(time.time())
        token = _sign(self.key, "key-1", _claims(iat=now - 3600, exp=now - 10))

        assert _verify(token)["sub"] == "user-1234"

    @responses.activate
    def test_missing_exp(self) -> None:
        self._serve_jwks(_public_jwk(self.key, "key-1"))
        claims = _claims()
        del claims["exp"]

        with pytest.raises(IdentityNotValid, match='"exp"'):
            _verify(_sign(self.key, "key-1", claims))

    @responses.activate
    def test_issued_in_the_future(self) -> None:
        self._serve_jwks(_public_jwk(self.key, "key-1"))
        now = int(time.time())
        token = _sign(self.key, "key-1", _claims(iat=now + 3600, exp=now + 7200))

        with pytest.raises(IdentityNotValid):
            _verify(token)

    @responses.activate
    def test_nonce(self) -> None:
        self._serve_jwks(_public_jwk(self.key, "key-1"))
        token = _sign(self.key, "key-1", _claims(nonce="expected-nonce"))

        assert _verify(token, nonce="expected-nonce")["nonce"] == "expected-nonce"
        with pytest.raises(IdentityNotValid, match="nonce"):
            _verify(token, nonce="other-nonce")
        with pytest.raises(IdentityNotValid, match="nonce"):
            _verify(_sign(self.key, "key-1", _claims()), nonce="expected-nonce")

    def test_rejects_unsigned_token(self) -> None:
        token = pyjwt.encode(_claims(), "", algorithm="none")

        with pytest.raises(IdentityNotValid, match="disallowed algorithm"):
            _verify(token)

    def test_rejects_symmetric_algorithm(self) -> None:
        token = pyjwt.encode(_claims(), "client-secret", algorithm="HS256")

        with pytest.raises(IdentityNotValid, match="disallowed algorithm"):
            _verify(token)

    def test_malformed_token(self) -> None:
        with pytest.raises(IdentityNotValid, match="Malformed"):
            _verify("not-a-jwt")

    def test_requires_audience(self) -> None:
        with pytest.raises(IdentityNotValid, match="client id"):
            verify_id_token(
                _sign(self.key, "key-1", _claims()),
                jwks_uri=JWKS_URI,
                issuers=(ISSUER,),
                audience="",
            )

    @responses.activate
    def test_algorithm_must_match_key(self) -> None:
        self._serve_jwks(_public_jwk(self.key, "key-1"))
        token = _sign(self.key, "key-1", _claims(), algorithm="RS512")

        with pytest.raises(IdentityNotValid, match="does not match its signing key"):
            _verify(token)

    @responses.activate
    def test_algorithm_must_suit_key_type(self) -> None:
        ec_key = ec.generate_private_key(ec.SECP256R1())
        ec_jwk = {**ECAlgorithm.to_jwk(ec_key.public_key(), as_dict=True), "kid": "key-1"}
        self._serve_jwks(ec_jwk)

        with pytest.raises(IdentityNotValid):
            _verify(_sign(self.key, "key-1", _claims()))

    @responses.activate
    def test_es256(self) -> None:
        ec_key = ec.generate_private_key(ec.SECP256R1())
        ec_jwk = {**ECAlgorithm.to_jwk(ec_key.public_key(), as_dict=True), "kid": "key-1"}
        self._serve_jwks(ec_jwk)

        token = _sign(ec_key, "key-1", _claims(), algorithm="ES256")

        assert _verify(token)["sub"] == "user-1234"

    @responses.activate
    def test_ignores_encryption_keys(self) -> None:
        self._serve_jwks({**_public_jwk(self.key, "key-1"), "use": "enc"})

        with pytest.raises(IdentityNotValid, match="unknown key"):
            _verify(_sign(self.key, "key-1", _claims()))

    @responses.activate
    def test_no_kid_with_single_key(self) -> None:
        self._serve_jwks(_public_jwk(self.key, "key-1"))

        assert _verify(_sign(self.key, None, _claims()))["sub"] == "user-1234"

    @responses.activate
    def test_no_kid_with_several_keys(self) -> None:
        self._serve_jwks(_public_jwk(self.key, "key-1"), _public_jwk(_rsa_key(), "key-2"))

        with pytest.raises(IdentityNotValid, match="unknown key"):
            _verify(_sign(self.key, None, _claims()))

    @responses.activate
    def test_unknown_kid_refetches_jwks(self) -> None:
        rotated = _rsa_key()
        self._serve_jwks(_public_jwk(self.key, "key-1"))
        _verify(_sign(self.key, "key-1", _claims()))

        responses.replace(
            responses.GET,
            JWKS_URI,
            json={"keys": [_public_jwk(self.key, "key-1"), _public_jwk(rotated, "key-2")]},
        )
        claims = _verify(_sign(rotated, "key-2", _claims()))

        assert claims["sub"] == "user-1234"
        assert self._jwks_calls() == 2

    @responses.activate
    def test_unknown_kid_refetch_is_rate_limited(self) -> None:
        self._serve_jwks(_public_jwk(self.key, "key-1"))
        unknown = _rsa_key()

        for _ in range(3):
            with pytest.raises(IdentityNotValid, match="unknown key"):
                _verify(_sign(unknown, "made-up", _claims()))

        # One fetch to fill the cache and one refresh for the unknown kid.
        assert self._jwks_calls() == 2

    @responses.activate
    def test_fetch_failure_serves_stale_keys(self) -> None:
        self._serve_jwks(_public_jwk(self.key, "key-1"))
        _verify(_sign(self.key, "key-1", _claims()))

        responses.replace(responses.GET, JWKS_URI, status=503)

        # Past the fresh window, but within the stale one.
        with freeze_time(datetime.now(UTC) + timedelta(hours=2)):
            assert _verify(_sign(self.key, "key-1", _claims()))["sub"] == "user-1234"
        assert self._jwks_calls() == 2

    @responses.activate
    def test_fetch_failure_after_stale_window_fails_closed(self) -> None:
        self._serve_jwks(_public_jwk(self.key, "key-1"))
        _verify(_sign(self.key, "key-1", _claims()))
        responses.replace(responses.GET, JWKS_URI, status=503)

        with freeze_time(datetime.now(UTC) + timedelta(days=2)):
            with pytest.raises(IdentityNotValid, match="signing keys"):
                _verify(_sign(self.key, "key-1", _claims()))

    @responses.activate
    def test_fetch_failure_without_cache_fails_closed(self) -> None:
        responses.add(responses.GET, JWKS_URI, status=503)

        with pytest.raises(IdentityNotValid, match="signing keys"):
            _verify(_sign(self.key, "key-1", _claims()))

    @responses.activate
    def test_malformed_jwks_fails_closed(self) -> None:
        responses.add(responses.GET, JWKS_URI, json={"keys": "nope"})

        with pytest.raises(IdentityNotValid, match="signing keys"):
            _verify(_sign(self.key, "key-1", _claims()))
