from __future__ import annotations

import time
from typing import Any

import jwt as pyjwt
import responses
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

ISSUER = "https://idp.example.com"
CLIENT_ID = "sentry-client"
CLIENT_SECRET = "s3cret value"
KID = "key-1"


def _rsa_key() -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


class FakeIdP:
    """An OpenID Connect provider backed by `responses`."""

    def __init__(self) -> None:
        self.key = _rsa_key()
        self.other_key = _rsa_key()

    def discovery_document(self, **overrides: Any) -> dict[str, Any]:
        document = {
            "issuer": ISSUER,
            "authorization_endpoint": f"{ISSUER}/authorize",
            "token_endpoint": f"{ISSUER}/token",
            "jwks_uri": f"{ISSUER}/jwks",
            "response_types_supported": ["code", "id_token"],
            "id_token_signing_alg_values_supported": ["RS256"],
            "token_endpoint_auth_methods_supported": ["client_secret_basic"],
        }
        document.update(overrides)
        return document

    def jwks(self) -> dict[str, Any]:
        jwk = RSAAlgorithm.to_jwk(self.key.public_key(), as_dict=True)
        jwk.update(kid=KID, use="sig", alg="RS256")
        return {"keys": [jwk]}

    def id_token(
        self,
        nonce: str,
        *,
        signing_key: rsa.RSAPrivateKey | None = None,
        headers: dict[str, Any] | None = None,
        **claims: Any,
    ) -> str:
        now = int(time.time())
        payload: dict[str, Any] = {
            "iss": ISSUER,
            "sub": "user-123",
            "aud": CLIENT_ID,
            "iat": now,
            "exp": now + 300,
            "nonce": nonce,
            "email": "alice@example.com",
            "email_verified": True,
            "name": "Alice",
        }
        payload.update(claims)
        payload = {k: v for k, v in payload.items() if v is not None}
        key: Any = signing_key or self.key
        return pyjwt.encode(
            payload, key, algorithm="RS256", headers={"kid": KID, **(headers or {})}
        )

    def add_discovery(self, **overrides: Any) -> None:
        responses.add(
            responses.GET,
            f"{ISSUER}/.well-known/openid-configuration",
            json=self.discovery_document(**overrides),
        )

    def add_jwks(self) -> None:
        responses.add(responses.GET, f"{ISSUER}/jwks", json=self.jwks())

    def add_token(self, id_token: str) -> None:
        responses.add(
            responses.POST,
            f"{ISSUER}/token",
            json={"access_token": "at", "token_type": "Bearer", "id_token": id_token},
        )
