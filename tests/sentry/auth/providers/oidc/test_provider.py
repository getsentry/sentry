from __future__ import annotations

from collections.abc import Generator

import pytest
from cryptography.fernet import Fernet
from django.test import override_settings

from sentry.auth.exceptions import IdentityNotValid
from sentry.auth.providers.oidc.provider import OIDCProvider, identity_id
from sentry.auth.providers.oidc.secrets import decrypt_client_secret, encrypt_client_secret
from sentry.models.authprovider import config_for_audit_log
from sentry.testutils.helpers import override_options
from sentry.utils.security.encrypted_field_key_store import FernetKeyStore

from . import ISSUER


@pytest.fixture
def fernet_key_id() -> Generator[str]:
    original = FernetKeyStore._keys, FernetKeyStore._is_loaded
    FernetKeyStore._keys = {"test-key": Fernet(Fernet.generate_key())}
    FernetKeyStore._is_loaded = True
    yield "test-key"
    FernetKeyStore._keys, FernetKeyStore._is_loaded = original


def test_client_secret_round_trip_with_fernet(fernet_key_id: str) -> None:
    with (
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": fernet_key_id}),
        override_options({"database.encryption.method": "fernet"}),
    ):
        encrypted = encrypt_client_secret("hunter2")
        assert encrypted.startswith(f"enc:fernet:{fernet_key_id}:")
        assert "hunter2" not in encrypted
        assert decrypt_client_secret(encrypted) == "hunter2"


def test_identity_id_is_scoped_to_issuer() -> None:
    assert identity_id(ISSUER, "sub") == identity_id(ISSUER, "sub")
    assert identity_id(ISSUER, "sub") != identity_id("https://other.example.com", "sub")
    assert len(identity_id(ISSUER, "x" * 255)) == 64


def test_build_identity() -> None:
    identity = OIDCProvider().build_identity(
        {"user": {"iss": ISSUER, "sub": "user-123", "email": "alice@example.com"}}
    )
    assert identity == {
        "id": identity_id(ISSUER, "user-123"),
        "email": "alice@example.com",
        "name": "alice@example.com",
        "email_verified": True,
        "data": {"iss": ISSUER, "sub": "user-123"},
    }


@pytest.mark.parametrize("user", [None, {"iss": ISSUER, "email": "a@example.com"}])
def test_build_identity_missing_claims(user: dict[str, str] | None) -> None:
    with pytest.raises(IdentityNotValid):
        OIDCProvider().build_identity({"user": user})


def test_audit_log_config_drops_client_secret() -> None:
    assert config_for_audit_log({"issuer": ISSUER, "client_secret": "enc:x"}) == {"issuer": ISSUER}
