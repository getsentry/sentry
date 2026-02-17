import base64

import pytest
from cryptography.fernet import Fernet
from django.test import override_settings

from sentry.db.models.fields.encryption._base import MARKER_FERNET, MARKER_PLAINTEXT, EncryptedField
from sentry.testutils.helpers import override_options
from sentry.utils.security.encrypted_field_key_store import FernetKeyStore

ENCRYPTION_METHODS = ("plaintext", "fernet")


def test_plaintext_encryption():
    with override_options({"database.encryption.method": "plaintext"}):
        field = EncryptedField()

        # Test encryption (should return marker:base64 encoded string)
        encrypted = field.get_prep_value("test value")
        assert encrypted == f"{MARKER_PLAINTEXT}:{base64.b64encode(b'test value').decode('ascii')}"
        assert isinstance(encrypted, str)

        # Test decryption (should return string)
        decrypted = field.to_python(
            f"{MARKER_PLAINTEXT}:{base64.b64encode(b'test value').decode('ascii')}"
        )
        assert decrypted == b"test value"
        assert isinstance(decrypted, bytes)


def test_fernet_encryption_without_key():
    """Test that Fernet encryption raises an error without key."""
    # Reset the key store to simulate no keys loaded
    original_keys = FernetKeyStore._keys
    original_is_loaded = FernetKeyStore._is_loaded

    FernetKeyStore._keys = None
    FernetKeyStore._is_loaded = True

    try:
        with (
            override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": "test_key"}),
            override_options({"database.encryption.method": "fernet"}),
        ):
            field = EncryptedField()
            with pytest.raises(ValueError, match="Fernet encryption keys are not loaded"):
                field.get_prep_value("test value")
    finally:
        FernetKeyStore._keys = original_keys
        FernetKeyStore._is_loaded = original_is_loaded


def test_fernet_encryption_with_key(multi_fernet_keys_store):
    """Test Fernet encryption with a valid key using new format."""
    with (
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": "key_primary"}),
        override_options({"database.encryption.method": "fernet"}),
    ):
        field = EncryptedField()

        # Test encryption
        encrypted = field.get_prep_value("test value")
        assert isinstance(encrypted, str)
        assert encrypted is not None

        # Should have the new format: enc:fernet:key_id:data
        parts = encrypted.split(":")
        assert len(parts) == 4
        enc, method, key_id, encoded_data = parts

        # Should start with enc:fernet marker
        assert f"{enc}:{method}" == MARKER_FERNET

        # Should use the first key (key_primary)
        assert key_id == "key_primary"

        # Verify the rest is valid fernet encrypted data
        fernet_data = base64.b64decode(encoded_data)
        # Should be able to decrypt with the correct key
        first_key = multi_fernet_keys_store["key_primary"]
        fernet_instance = Fernet(first_key)
        decrypted_bytes = fernet_instance.decrypt(fernet_data)
        assert decrypted_bytes == b"test value"

        # Test decryption through field
        decrypted = field.to_python(encrypted)
        assert decrypted == b"test value"


def test_fernet_key_rotation(multi_fernet_keys_store):
    """Test that data encrypted with different keys can be decrypted."""
    with (
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": "key_primary"}),
        override_options({"database.encryption.method": "fernet"}),
    ):
        field = EncryptedField()

        # Encrypt some data
        encrypted_value = field.get_prep_value("test data")

        # Should be able to decrypt it
        decrypted_value = field.to_python(encrypted_value)
        assert decrypted_value == b"test data"

        # Manually create encrypted data with the second key
        second_key_id = "key_secondary"
        second_key = multi_fernet_keys_store[second_key_id]
        fernet_instance = Fernet(second_key)
        manual_encrypted = fernet_instance.encrypt(b"second key data")
        manual_encoded = base64.b64encode(manual_encrypted).decode("ascii")
        manual_formatted = f"{MARKER_FERNET}:{second_key_id}:{manual_encoded}"

        # Should be able to decrypt data encrypted with the second key
        decrypted_manual = field.to_python(manual_formatted)
        assert decrypted_manual == b"second key data"


def test_fernet_format_without_key_id_rejected(fernet_keys_store):
    """Test that Fernet format without key_id is rejected."""
    key_id, fernet_key = fernet_keys_store

    with (
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": key_id}),
        override_options({"database.encryption.method": "fernet"}),
    ):
        field = EncryptedField()

        # Create invalid format without key_id
        fernet_instance = Fernet(fernet_key)
        encrypted_data = fernet_instance.encrypt(b"test data")
        encoded_data = base64.b64encode(encrypted_data).decode("ascii")
        invalid_format = f"{MARKER_FERNET}:{encoded_data}"

        # Should return the original value as it's invalid format
        result = field.to_python(invalid_format)
        assert result == invalid_format


def test_encryption_method_switching(fernet_keys_store):
    """Test that values can be decrypted after switching encryption methods."""
    key_id, _fernet_key = fernet_keys_store

    # encrypt with Fernet
    with (
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": key_id}),
        override_options({"database.encryption.method": "fernet"}),
    ):
        field = EncryptedField()
        encrypted_fernet = field.get_prep_value("fernet encrypted")

    # encrypt with plain text
    with override_options({"database.encryption.method": "plaintext"}):
        field = EncryptedField()
        encrypted_plain = field.get_prep_value("plain text value")

    # assert that both can be decrypted independently of the encryption method
    for encryption_method in ENCRYPTION_METHODS:
        with (
            override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": key_id}),
            override_options({"database.encryption.method": encryption_method}),
        ):
            field = EncryptedField()

            # Should decrypt fernet value
            decrypted_fernet = field.to_python(encrypted_fernet)
            assert decrypted_fernet == b"fernet encrypted"

            # Should also handle plain text (fallback)
            decrypted_plain = field.to_python(encrypted_plain)
            assert decrypted_plain == b"plain text value"


def test_fernet_non_utf_8_chars(fernet_keys_store):
    """Test that different encrypted field types work correctly."""
    key_id, _fernet_key = fernet_keys_store

    with (
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": key_id}),
        override_options({"database.encryption.method": "fernet"}),
    ):
        text_field = EncryptedField()
        invalid_utf_8 = b"\xc0"
        encrypted_text = text_field.get_prep_value(invalid_utf_8)
        assert isinstance(encrypted_text, str)

        # Should have new format with key_id
        parts = encrypted_text.split(":")
        assert len(parts) == 4

        decrypted_text = text_field.to_python(encrypted_text)
        # The field now preserves the original data type
        # When bytes can't be decoded as UTF-8, they are returned as bytes, not converted to string
        assert decrypted_text == invalid_utf_8


def test_keysets_not_implemented():
    """Test that keysets method raises NotImplementedError."""
    with override_options({"database.encryption.method": "keysets"}):
        field = EncryptedField()

        with pytest.raises(NotImplementedError, match="Keysets encryption not yet implemented"):
            field.get_prep_value("test value")


def test_fernet_marker_handling(fernet_keys_store):
    """Test that the fernet marker is handled correctly."""
    key_id, _fernet_key = fernet_keys_store

    with (
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": key_id}),
        override_options({"database.encryption.method": "fernet"}),
    ):
        field = EncryptedField()

        # Create a value with fernet encryption
        test_value = "test value"
        encrypted = field.get_prep_value(test_value)
        assert encrypted is not None

        # Verify it has the new format: enc:fernet:key_id:data
        parts = encrypted.split(":")
        assert len(parts) == 4
        assert f"{parts[0]}:{parts[1]}" == MARKER_FERNET

        # Test that decryption works with marker and key_id
        decrypted = field.to_python(encrypted)
        assert decrypted == test_value.encode("utf-8")


def test_data_without_marker():
    """Test handling of unencrypted data without method marker."""
    with override_options({"database.encryption.method": "plaintext"}):
        field = EncryptedField()

        # Simulate unencrypted plain text data (no marker)
        plain_value = "unencrypted plain text"
        decrypted = field.to_python(plain_value)
        assert decrypted == plain_value


def test_to_python_conversion():
    """Test the to_python method."""
    field = EncryptedField()

    # Test string
    assert field.to_python("test") == "test"

    # Test None
    assert field.to_python(None) is None

    # Test encrypted format
    with override_options({"database.encryption.method": "plaintext"}):
        encrypted = f"{MARKER_PLAINTEXT}:{base64.b64encode(b'test bytes').decode('ascii')}"
        assert field.to_python(encrypted) == b"test bytes"


def test_non_utf8_data_handling(fernet_keys_store):
    """Test handling of non-UTF8 data."""
    key_id, _fernet_key = fernet_keys_store
    invalid_value = b"\xc0"  # invalid UTF-8 char

    for encryption_method in ENCRYPTION_METHODS:
        with (
            override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": key_id}),
            override_options({"database.encryption.method": encryption_method}),
        ):
            field = EncryptedField()
            result = field.to_python(invalid_value)
            assert result == invalid_value


@pytest.mark.parametrize("encryption_method", ENCRYPTION_METHODS)
@pytest.mark.parametrize(
    "test_value",
    [
        "simple text",
        "text with unicode: 你好",
        "text with special chars: !@#$%^&*()",
        "",
        None,
        "a" * 1000,
        b"bytes data",
        b"invalid utf-8: \xc0",
    ],
)
def test_encryption_decryption_roundtrip(encryption_method, test_value, fernet_keys_store):
    """Test that encryption and decryption work correctly in roundtrip."""
    key_id, _fernet_key = fernet_keys_store

    with (
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": key_id}),
        override_options({"database.encryption.method": encryption_method}),
    ):
        field = EncryptedField()

        encrypted = field.get_prep_value(test_value)
        decrypted = field.to_python(encrypted)

        if test_value is None:
            assert decrypted is None
        elif isinstance(test_value, str):
            assert decrypted == test_value.encode("utf-8")
        else:
            assert decrypted == test_value


def test_marker_format_consistency(fernet_keys_store):
    """Test that the marker format is consistent across methods."""
    key_id, _fernet_key = fernet_keys_store
    field = EncryptedField()

    with override_options({"database.encryption.method": "plaintext"}):
        encrypted = field.get_prep_value("test")
        assert encrypted is not None
        assert encrypted.startswith(f"{MARKER_PLAINTEXT}:")

    with (
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": key_id}),
        override_options({"database.encryption.method": "fernet"}),
    ):
        encrypted = field.get_prep_value("test")
        assert encrypted is not None
        assert encrypted.startswith(f"{MARKER_FERNET}:")


def test_fernet_missing_key_decryption(fernet_keys_store):
    """Test that decryption fails gracefully when key_id is not found."""
    key_id, _fernet_key = fernet_keys_store

    with (
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": key_id}),
        override_options({"database.encryption.method": "fernet"}),
    ):
        field = EncryptedField()

        # Try to decrypt data that was "encrypted" with a missing key
        fake_encrypted_data = base64.b64encode(b"fake data").decode("ascii")
        formatted_value = f"{MARKER_FERNET}:missing_key:{fake_encrypted_data}"

        # Should fall back to returning the original value when key is missing
        result = field.to_python(formatted_value)
        assert result == formatted_value  # Should return the original encrypted string


def test_fernet_format_with_plaintext_data(fernet_keys_store):
    """Test that data in fernet format but containing plain text (not encrypted) falls back correctly."""
    key_id, _fernet_key = fernet_keys_store

    with (
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": key_id}),
        override_options({"database.encryption.method": "fernet"}),
    ):
        field = EncryptedField()

        # Create data that looks like fernet format but contains plain text instead of encrypted data
        # This could happen during migration from plain text to encrypted storage
        plaintext_content = "this is just plain text, not encrypted"
        fake_fernet_data = f"{MARKER_FERNET}:{key_id}:{plaintext_content}"

        # Should fall back to returning the original string since it's not valid encrypted data
        result = field.to_python(fake_fernet_data)
        assert result == fake_fernet_data  # Should return the original string as-is

        # Test with a format that has valid base64 but invalid fernet data
        fake_base64_data = base64.b64encode(b"not fernet encrypted").decode("ascii")
        fake_fernet_with_base64 = f"{MARKER_FERNET}:{key_id}:{fake_base64_data}"

        result = field.to_python(fake_fernet_with_base64)
        # This should also fall back to the original string since it's not valid Fernet data
        assert result == fake_fernet_with_base64
