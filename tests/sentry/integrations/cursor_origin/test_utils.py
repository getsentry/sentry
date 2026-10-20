from __future__ import annotations

import time

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.asymmetric.rsa import generate_private_key

from sentry.integrations.cursor_origin.constants import (
    CURSOR_ORIGIN_JWT_AUDIENCE,
    JWT_EXPIRY_SECONDS,
)
from sentry.integrations.cursor_origin.utils import get_jwt
from sentry.testutils.cases import TestCase

APP_ID = "app_01example"


def _ed25519_pem() -> tuple[Ed25519PrivateKey, str]:
    key = Ed25519PrivateKey.generate()
    pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    return key, pem


class GetJwtTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.private_key, self.pem = _ed25519_pem()

    def test_header_names_the_app(self) -> None:
        """Origin selects the registered public key by the `kid` header."""
        token = get_jwt(app_id=APP_ID, private_key=self.pem)

        header = jwt.get_unverified_header(token)
        assert header["alg"] == "EdDSA"
        assert header["kid"] == APP_ID
        assert header["typ"] == "JWT"

    def test_claims_verify_against_the_public_key(self) -> None:
        before = int(time.time())
        token = get_jwt(app_id=APP_ID, private_key=self.pem)

        claims = jwt.decode(
            token,
            key=self.private_key.public_key(),
            algorithms=["EdDSA"],
            audience=CURSOR_ORIGIN_JWT_AUDIENCE,
        )

        assert claims["iss"] == APP_ID
        assert claims["aud"] == CURSOR_ORIGIN_JWT_AUDIENCE
        # Backdated to absorb clock skew, so `iat` may sit just before "now".
        assert claims["iat"] <= before
        assert before < claims["exp"] <= before + JWT_EXPIRY_SECONDS + 1

    def test_expiry_stays_inside_origins_ceiling(self) -> None:
        """Origin caps app JWTs at roughly five minutes."""
        assert JWT_EXPIRY_SECONDS < 300

    def test_reads_options_when_not_passed(self) -> None:
        with self.options(
            {"cursor-origin-app.id": APP_ID, "cursor-origin-app.private-key": self.pem}
        ):
            token = get_jwt()

        assert jwt.get_unverified_header(token)["kid"] == APP_ID

    def test_unconfigured_private_key_names_the_option(self) -> None:
        """An empty key must not fail deeper inside `cryptography`."""
        with pytest.raises(ValueError) as excinfo:
            get_jwt(app_id=APP_ID, private_key="")

        assert "cursor-origin-app.private-key" in str(excinfo.value)

    def test_unconfigured_app_id_names_the_option(self) -> None:
        with pytest.raises(ValueError) as excinfo:
            get_jwt(app_id="", private_key=self.pem)

        assert "cursor-origin-app.id" in str(excinfo.value)

    def test_non_ed25519_key_is_rejected(self) -> None:
        """A well-formed PEM of the wrong type is a configuration error, not an algorithm one."""
        rsa_pem = (
            generate_private_key(public_exponent=65537, key_size=2048)
            .private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
            .decode("utf-8")
        )

        with pytest.raises(ValueError) as excinfo:
            get_jwt(app_id=APP_ID, private_key=rsa_pem)

        assert "not Ed25519" in str(excinfo.value)
