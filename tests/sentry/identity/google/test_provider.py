from __future__ import annotations

import time
from typing import Any

import jwt as pyjwt
import pytest
import responses
from cryptography.hazmat.primitives.asymmetric import rsa
from django.core.cache import cache
from jwt.algorithms import RSAAlgorithm

from sentry.auth.exceptions import IdentityNotValid
from sentry.auth.provider import MigratingIdentityId
from sentry.identity.google.provider import GOOGLE_JWKS_URI, GoogleIdentityProvider
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options

CLIENT_ID = "test-client.apps.googleusercontent.com"


class GoogleIdentityProviderTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        cache.clear()
        self.enterContext(override_options({"auth-google.client-id": CLIENT_ID}))
        self.key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        jwk = RSAAlgorithm.to_jwk(self.key.public_key(), as_dict=True)
        self.enterContext(responses.mock)
        responses.add(
            responses.GET,
            GOOGLE_JWKS_URI,
            json={"keys": [{**jwk, "kid": "google-key", "alg": "RS256", "use": "sig"}]},
        )
        self.provider = GoogleIdentityProvider()

    def _id_token(self, signing_key: Any = None, **overrides: Any) -> str:
        now = int(time.time())
        claims = {
            "iss": "https://accounts.google.com",
            "azp": CLIENT_ID,
            "aud": CLIENT_ID,
            "sub": "1234567890",
            "hd": "example.com",
            "email": "user@example.com",
            "email_verified": True,
            "iat": now,
            "exp": now + 3600,
            **overrides,
        }
        return pyjwt.encode(
            {name: value for name, value in claims.items() if value is not None},
            signing_key or self.key,
            algorithm="RS256",
            headers={"kid": "google-key"},
        )

    def _state(self, id_token: str) -> dict[str, Any]:
        return {
            "data": {
                "access_token": "access-token",
                "expires_in": 3600,
                "token_type": "Bearer",
                "id_token": id_token,
            }
        }

    @freeze_time()
    def test_build_identity(self) -> None:
        identity = self.provider.build_identity(self._state(self._id_token()))

        assert identity == {
            "type": "google",
            "id": MigratingIdentityId(id="1234567890", legacy_id="user@example.com"),
            "email": "user@example.com",
            "email_verified": True,
            "name": "user@example.com",
            "domain": "example.com",
            "scopes": ["email"],
            "data": {
                "access_token": "access-token",
                "expires": int(time.time()) + 3600,
                "token_type": "Bearer",
            },
        }
        assert isinstance(identity["id"], MigratingIdentityId)

    def test_build_identity_short_issuer_and_no_hosted_domain(self) -> None:
        token = self._id_token(iss="accounts.google.com", hd=None, email_verified="false")

        identity = self.provider.build_identity(self._state(token))

        assert identity["domain"] == "gmail.com"
        assert identity["email_verified"] is False

    def test_build_identity_rejects_forged_token(self) -> None:
        forged_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

        with pytest.raises(IdentityNotValid):
            self.provider.build_identity(self._state(self._id_token(signing_key=forged_key)))

    def test_build_identity_rejects_token_for_another_client(self) -> None:
        token = self._id_token(aud="another-client", azp="another-client")

        with pytest.raises(IdentityNotValid):
            self.provider.build_identity(self._state(token))

    def test_build_identity_rejects_other_issuer(self) -> None:
        with pytest.raises(IdentityNotValid):
            self.provider.build_identity(self._state(self._id_token(iss="https://example.com")))

    def test_build_identity_missing_id_token(self) -> None:
        with pytest.raises(IdentityNotValid, match="Missing id_token"):
            self.provider.build_identity({"data": {"access_token": "access-token"}})
