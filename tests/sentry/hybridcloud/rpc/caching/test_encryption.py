import base64
from collections.abc import Generator, Mapping
from contextlib import contextmanager
from unittest.mock import patch

import pytest
from cryptography.fernet import Fernet
from django.test import override_settings

from sentry.hybridcloud.rpc.caching.encryption import (
    CacheEncrypter,
    EncryptionMethod,
    InvalidEncodingError,
    InvalidEncryptionMethod,
)
from sentry.testutils.silo import no_silo_test
from sentry.utils.security.encrypted_field_key_store import FernetKeyStore

PAYLOAD = '{"id": 1, "email": "user@example.com"}'


@contextmanager
def fernet_keys(primary_id: str | None, keys: Mapping[str, Fernet]) -> Generator[None]:
    """
    Load the given in-memory Fernet keys and select ``primary_id`` for encryption.
    """
    original_keys = FernetKeyStore._keys
    original_is_loaded = FernetKeyStore._is_loaded
    FernetKeyStore._keys = dict(keys)
    FernetKeyStore._is_loaded = True
    try:
        with override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": primary_id}):
            yield
    finally:
        FernetKeyStore._keys = original_keys
        FernetKeyStore._is_loaded = original_is_loaded


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


@no_silo_test
def test_fernet_round_trip() -> None:
    with fernet_keys("k1", {"k1": Fernet(Fernet.generate_key())}):
        stored = CacheEncrypter.encrypt(PAYLOAD, EncryptionMethod.FERNET)

        assert stored.startswith("enc:fernet:k1:")
        assert "user@example.com" not in stored
        assert CacheEncrypter.decrypt(stored) == PAYLOAD


@no_silo_test
def test_decrypt_unprefixed_value_raises() -> None:
    with pytest.raises(InvalidEncryptionMethod):
        CacheEncrypter.decrypt(PAYLOAD)

    with pytest.raises(InvalidEncryptionMethod):
        CacheEncrypter.decrypt("")


@no_silo_test
def test_decrypt_unknown_method_raises() -> None:
    with pytest.raises(InvalidEncryptionMethod):
        CacheEncrypter.decrypt("enc:tink:abcd")
    with pytest.raises(InvalidEncryptionMethod):
        CacheEncrypter.decrypt("enc:nocolon")
    with pytest.raises(InvalidEncryptionMethod):
        CacheEncrypter.decrypt("enc:invalid:not*base64!")


@no_silo_test
def test_decrypt_corrupt_base64_returns_original() -> None:
    fernet_value = "enc:fernet:k1:not*base64!"

    with fernet_keys("k1", {"k1": Fernet(Fernet.generate_key())}):
        assert CacheEncrypter.decrypt(fernet_value) == fernet_value
        assert CacheEncrypter.decrypt("enc:fernet:missing-key-id") == "enc:fernet:missing-key-id"


@no_silo_test
def test_decrypt_invalid_token_returns_original() -> None:
    value = f"enc:fernet:k1:{_b64(b'not a fernet token')}"

    with fernet_keys("k1", {"k1": Fernet(Fernet.generate_key())}):
        assert CacheEncrypter.decrypt(value) == value


@no_silo_test
def test_decrypt_non_utf8_plaintext_raises() -> None:
    k1 = Fernet(Fernet.generate_key())
    token = k1.encrypt(b"\xff\xfe")
    value = f"enc:fernet:k1:{_b64(token)}"

    with fernet_keys("k1", {"k1": k1}):
        with pytest.raises(InvalidEncodingError):
            CacheEncrypter.decrypt(value)


@no_silo_test
def test_decrypt_unknown_key_id_returns_original_without_reporting() -> None:
    with fernet_keys("k1", {"k1": Fernet(Fernet.generate_key())}):
        stored = CacheEncrypter.encrypt(PAYLOAD, EncryptionMethod.FERNET)
        relabelled = stored.replace("enc:fernet:k1:", "enc:fernet:k2:", 1)

        with patch(
            "sentry.hybridcloud.rpc.caching.encryption.sentry_sdk.capture_exception"
        ) as capture_exception:
            assert CacheEncrypter.decrypt(relabelled) == relabelled

    capture_exception.assert_not_called()


@no_silo_test
def test_encrypt_unknown_method_raises() -> None:
    with fernet_keys("k1", {"k1": Fernet(Fernet.generate_key())}):
        with pytest.raises(InvalidEncryptionMethod):
            CacheEncrypter.encrypt(PAYLOAD, EncryptionMethod.PLAINTEXT)


@no_silo_test
def test_encrypt_fernet_without_primary_key_raises() -> None:
    with fernet_keys(None, {"k1": Fernet(Fernet.generate_key())}):
        with pytest.raises(ValueError):
            CacheEncrypter.encrypt(PAYLOAD, EncryptionMethod.FERNET)


@no_silo_test
def test_encrypt_fernet_with_unloaded_primary_key_raises() -> None:
    with fernet_keys("k2", {"k1": Fernet(Fernet.generate_key())}):
        with pytest.raises(ValueError):
            CacheEncrypter.encrypt(PAYLOAD, EncryptionMethod.FERNET)


@no_silo_test
def test_key_rotation_keeps_old_entries_readable() -> None:
    keys = {"k1": Fernet(Fernet.generate_key()), "k2": Fernet(Fernet.generate_key())}

    with fernet_keys("k1", keys):
        old = CacheEncrypter.encrypt(PAYLOAD, EncryptionMethod.FERNET)
    assert old.startswith("enc:fernet:k1:")

    with fernet_keys("k2", keys):
        new = CacheEncrypter.encrypt(PAYLOAD, EncryptionMethod.FERNET)

        assert new.startswith("enc:fernet:k2:")
        assert CacheEncrypter.decrypt(old) == PAYLOAD
        assert CacheEncrypter.decrypt(new) == PAYLOAD


@no_silo_test
def test_decrypt_failure_records_metric() -> None:
    value = f"enc:fernet:k1:{_b64(b'not a fernet token')}"

    with (
        fernet_keys("k1", {"k1": Fernet(Fernet.generate_key())}),
        patch("sentry.hybridcloud.rpc.caching.encryption.metrics") as metrics,
    ):
        assert CacheEncrypter.decrypt(value) == value

    metrics.incr.assert_called_once_with(
        "hybridcloud.caching.decrypt", tags={"method": "fernet", "status": "failure"}
    )


@no_silo_test
def test_encrypt_success_records_metric() -> None:
    with (
        patch("sentry.hybridcloud.rpc.caching.encryption.metrics") as metrics,
        fernet_keys("k1", {"k1": Fernet(Fernet.generate_key())}),
    ):
        CacheEncrypter.encrypt(PAYLOAD, EncryptionMethod.FERNET)

    metrics.incr.assert_called_once_with(
        "hybridcloud.caching.encrypt", tags={"method": "fernet", "status": "success"}
    )
