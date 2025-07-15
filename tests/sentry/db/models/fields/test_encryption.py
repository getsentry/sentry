import base64

import pytest
from cryptography.fernet import Fernet
from django.test import override_settings

from sentry.db.models.fields.encryption import MARKER_FERNET, MARKER_PLAIN_TEXT, EncryptedField
from sentry.testutils.helpers.options import override_options

ENCRYPTION_METHODS = ("plain_text", "fernet")


@pytest.fixture
def fernet_key():
    return Fernet.generate_key()


@pytest.fixture
def fernet_instance(fernet_key):
    return Fernet(fernet_key)


@pytest.fixture
def fernet_keys_value(fernet_key):
    return {"key_id_1": fernet_key.decode()}


@pytest.fixture
def multi_fernet_keys_value():
    """Multiple keys for testing key rotation."""
    key1 = Fernet.generate_key()
    key2 = Fernet.generate_key()
    return {
        "key_primary": key1.decode(),
        "key_secondary": key2.decode(),
    }


def test_plain_text_encryption():
    with override_options({"database.encryption.method": "plain_text"}):
        field = EncryptedField()

        # Test encryption (should return marker:base64 encoded string)
        encrypted = field.get_prep_value("test value")
        assert encrypted == f"{MARKER_PLAIN_TEXT}:{base64.b64encode(b'test value').decode('ascii')}"
        assert isinstance(encrypted, str)

        # Test decryption (should return string)
        decrypted = field.to_python(
            f"{MARKER_PLAIN_TEXT}:{base64.b64encode(b'test value').decode('ascii')}"
        )
        assert decrypted == "test value"
        assert isinstance(decrypted, str)


@override_settings(DATABASE_ENCRYPTION_FERNET_KEYS=None)
def test_fernet_encryption_without_key():
    """Test that Fernet encryption raises an error without key."""
    with override_options({"database.encryption.method": "fernet"}):
        field = EncryptedField()

        with pytest.raises(ValueError, match="DATABASE_ENCRYPTION_FERNET_KEYS is not configured"):
            field.get_prep_value("test value")


def test_fernet_encryption_with_key(multi_fernet_keys_value):
    """Test Fernet encryption with a valid key using new format."""
    with override_options({"database.encryption.method": "fernet"}):
        with override_settings(DATABASE_ENCRYPTION_FERNET_KEYS=multi_fernet_keys_value):
            field = EncryptedField()

            # Test encryption
            encrypted = field.get_prep_value("test value")
            assert isinstance(encrypted, str)
            assert encrypted is not None

            # Should have the new format: marker:key_id:data
            parts = encrypted.split(":")
            assert len(parts) == 3
            marker, key_id, encoded_data = parts

            # Should start with fernet marker
            assert marker == MARKER_FERNET

            # Should use the first key (key_primary)
            assert key_id == "key_primary"

            # Verify the rest is valid fernet encrypted data
            fernet_data = base64.b64decode(encoded_data)
            # Should be able to decrypt with the correct key
            first_key = list(multi_fernet_keys_value.values())[0]
            fernet_instance = Fernet(first_key.encode())
            decrypted_bytes = fernet_instance.decrypt(fernet_data)
            assert decrypted_bytes == b"test value"

            # Test decryption through field
            decrypted = field.to_python(encrypted)
            assert decrypted == "test value"


def test_fernet_key_rotation(multi_fernet_keys_value):
    """Test that data encrypted with different keys can be decrypted."""
    with override_options({"database.encryption.method": "fernet"}):
        with override_settings(DATABASE_ENCRYPTION_FERNET_KEYS=multi_fernet_keys_value):
            field = EncryptedField()

            # Encrypt some data
            encrypted_value = field.get_prep_value("test data")

            # Should be able to decrypt it
            decrypted_value = field.to_python(encrypted_value)
            assert decrypted_value == "test data"

            # Manually create encrypted data with the second key
            second_key_id = list(multi_fernet_keys_value.keys())[1]
            second_key = multi_fernet_keys_value[second_key_id]
            fernet_instance = Fernet(second_key.encode())
            manual_encrypted = fernet_instance.encrypt(b"second key data")
            manual_encoded = base64.b64encode(manual_encrypted).decode("ascii")
            manual_formatted = f"{MARKER_FERNET}:{second_key_id}:{manual_encoded}"

            # Should be able to decrypt data encrypted with the second key
            decrypted_manual = field.to_python(manual_formatted)
            assert decrypted_manual == "second key data"


def test_fernet_plain_text_format_compatibility(fernet_keys_value):
    """Test that plain text format (without key_id) works."""
    with override_options({"database.encryption.method": "fernet"}):
        with override_settings(DATABASE_ENCRYPTION_FERNET_KEYS=fernet_keys_value):
            field = EncryptedField()

            # Create plain text format manually (marker:data without key_id)
            key = list(fernet_keys_value.values())[0]
            fernet_instance = Fernet(key.encode())
            encrypted_data = fernet_instance.encrypt(b"plain text data")
            encoded_data = base64.b64encode(encrypted_data).decode("ascii")
            plain_text_format = f"{MARKER_FERNET}:{encoded_data}"

            # Should be able to decrypt plain text format
            decrypted = field.to_python(plain_text_format)
            assert decrypted == "plain text data"


def test_encryption_method_switching(fernet_keys_value):
    """Test that values can be decrypted after switching encryption methods."""
    # encrypt with Fernet
    with (
        override_options({"database.encryption.method": "fernet"}),
        override_settings(DATABASE_ENCRYPTION_FERNET_KEYS=fernet_keys_value),
    ):
        field = EncryptedField()
        encrypted_fernet = field.get_prep_value("fernet encrypted")

    # encrypt with plain text
    with override_options({"database.encryption.method": "plain_text"}):
        field = EncryptedField()
        encrypted_plain = field.get_prep_value("plain text value")

    # assert that both can be decrypted independently of the encryption method
    for encryption_method in ENCRYPTION_METHODS:
        with (
            override_options({"database.encryption.method": encryption_method}),
            override_settings(DATABASE_ENCRYPTION_FERNET_KEYS=fernet_keys_value),
        ):
            field = EncryptedField()

            # Should decrypt fernet value
            decrypted_fernet = field.to_python(encrypted_fernet)
            assert decrypted_fernet == "fernet encrypted"

            # Should also handle plain text (fallback)
            decrypted_plain = field.to_python(encrypted_plain)
            assert decrypted_plain == "plain text value"


def test_invalid_fernet_key():
    """Test handling of invalid Fernet keys."""
    with override_options({"database.encryption.method": "fernet"}):
        with override_settings(DATABASE_ENCRYPTION_FERNET_KEYS={"key1": "invalid-key"}):
            field = EncryptedField()

            # Should raise an error due to invalid key
            with pytest.raises(ValueError, match="Invalid Fernet key for key_id 'key1'"):
                field.get_prep_value("test value")


def test_fernet_key_dict_format():
    """Test that fernet key dictionary format works correctly."""
    key1 = Fernet.generate_key()
    key2 = Fernet.generate_key()
    keys_dict = {
        "key1": key1.decode(),
        "key2": key2.decode(),
    }

    with override_options({"database.encryption.method": "fernet"}):
        with override_settings(DATABASE_ENCRYPTION_FERNET_KEYS=keys_dict):
            field = EncryptedField()

            # Should use first key by default and include key_id
            encrypted = field.get_prep_value("test value")
            assert isinstance(encrypted, str)

            # Should have new format with key_id
            parts = encrypted.split(":")
            assert len(parts) == 3
            marker, key_id, encoded_data = parts
            assert marker == MARKER_FERNET
            assert key_id == "key1"  # First key in dict

            # Should be able to decrypt
            decrypted = field.to_python(encrypted)
            assert decrypted == "test value"


def test_fernet_key_dict_must_be_dict():
    """Test that DATABASE_ENCRYPTION_FERNET_KEYS must be a dictionary."""
    with override_options({"database.encryption.method": "fernet"}):
        # Test with string instead of dict
        with override_settings(DATABASE_ENCRYPTION_FERNET_KEYS="not-a-dict"):
            field = EncryptedField()

            with pytest.raises(
                ValueError, match="DATABASE_ENCRYPTION_FERNET_KEYS must be a dictionary"
            ):
                field.get_prep_value("test value")

        # Test with list instead of dict
        with override_settings(DATABASE_ENCRYPTION_FERNET_KEYS=["key1", "key2"]):
            field = EncryptedField()

            with pytest.raises(
                ValueError, match="DATABASE_ENCRYPTION_FERNET_KEYS must be a dictionary"
            ):
                field.get_prep_value("test value")


def test_fernet_empty_keys_dict():
    """Test handling of empty keys dictionary."""
    with (
        override_options({"database.encryption.method": "fernet"}),
        override_settings(DATABASE_ENCRYPTION_FERNET_KEYS={}),
    ):
        field = EncryptedField()

        with pytest.raises(ValueError, match="DATABASE_ENCRYPTION_FERNET_KEYS is empty"):
            field.get_prep_value("test value")


def test_fernet_non_utf_8_chars(fernet_keys_value):
    """Test that different encrypted field types work correctly."""
    with (
        override_options({"database.encryption.method": "fernet"}),
        override_settings(DATABASE_ENCRYPTION_FERNET_KEYS=fernet_keys_value),
    ):
        text_field = EncryptedField()
        invalid_utf_8 = b"\xc0"
        encrypted_text = text_field.get_prep_value(invalid_utf_8)
        assert isinstance(encrypted_text, str)

        # Should have new format with key_id
        parts = encrypted_text.split(":")
        assert len(parts) == 3

        decrypted_text = text_field.to_python(encrypted_text)
        # The field converts bytes to string representation when encrypting
        expected_string = "b'\\xc0'"
        assert decrypted_text == expected_string


def test_keysets_not_implemented():
    """Test that keysets method raises NotImplementedError."""
    with override_options({"database.encryption.method": "keysets"}):
        field = EncryptedField()

        with pytest.raises(NotImplementedError, match="Keysets encryption not yet implemented"):
            field.get_prep_value("test value")


def test_fernet_marker_handling(fernet_keys_value):
    """Test that the fernet marker is handled correctly."""
    with override_options({"database.encryption.method": "fernet"}):
        with override_settings(DATABASE_ENCRYPTION_FERNET_KEYS=fernet_keys_value):
            field = EncryptedField()

            # Create a value with fernet encryption
            test_value = "test value"
            encrypted = field.get_prep_value(test_value)
            assert encrypted is not None

            # Verify it has the new format: marker:key_id:data
            parts = encrypted.split(":")
            assert len(parts) == 3
            assert parts[0] == MARKER_FERNET

            # Test that decryption works with marker and key_id
            decrypted = field.to_python(encrypted)
            assert decrypted == test_value


def test_data_without_marker():
    """Test handling of unencrypted data without method marker."""
    with override_options({"database.encryption.method": "plain_text"}):
        field = EncryptedField()

        # Simulate unencrypted plain text data (no marker)
        plain_value = "unencrypted plain text"
        decrypted = field.to_python(plain_value)
        assert decrypted == "unencrypted plain text"


def test_to_python_conversion():
    """Test the to_python method."""
    field = EncryptedField()

    # Test string
    assert field.to_python("test") == "test"

    # Test None
    assert field.to_python(None) is None

    # Test encrypted format
    with override_options({"database.encryption.method": "plain_text"}):
        encrypted = f"{MARKER_PLAIN_TEXT}:{base64.b64encode(b'test bytes').decode('ascii')}"
        assert field.to_python(encrypted) == "test bytes"


def test_non_utf8_data_handling(fernet_keys_value):
    """Test handling of non-UTF8 data."""

    invalid_value = b"\xc0"  # invalid UTF-8 char

    for encryption_method in ENCRYPTION_METHODS:
        with override_options({"database.encryption.method": encryption_method}):
            settings_override = {}
            if encryption_method == "fernet":
                settings_override["DATABASE_ENCRYPTION_FERNET_KEYS"] = fernet_keys_value

            with override_settings(**settings_override):
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
    ],
)
def test_encryption_decryption_roundtrip(encryption_method, test_value, fernet_keys_value):
    """Test that encryption and decryption work correctly in roundtrip."""
    with override_options({"database.encryption.method": encryption_method}):
        settings_override = {}
        if encryption_method == "fernet":
            settings_override["DATABASE_ENCRYPTION_FERNET_KEYS"] = fernet_keys_value

        with override_settings(**settings_override):
            field = EncryptedField()

            encrypted = field.get_prep_value(test_value)
            decrypted = field.to_python(encrypted)
            assert decrypted == test_value


def test_marker_format_consistency(fernet_keys_value):
    """Test that the marker format is consistent across methods."""
    field = EncryptedField()

    with override_options({"database.encryption.method": "plain_text"}):
        encrypted = field.get_prep_value("test")
        assert encrypted is not None
        assert encrypted.startswith(f"{MARKER_PLAIN_TEXT}:")

    with override_options({"database.encryption.method": "fernet"}):
        with override_settings(DATABASE_ENCRYPTION_FERNET_KEYS=fernet_keys_value):
            encrypted = field.get_prep_value("test")
            assert encrypted is not None
            assert encrypted.startswith(f"{MARKER_FERNET}:")


def test_fernet_missing_key_decryption():
    """Test that decryption fails gracefully when key_id is not found."""
    keys_dict = {
        "key1": Fernet.generate_key().decode(),
    }

    with override_options({"database.encryption.method": "fernet"}):
        with override_settings(DATABASE_ENCRYPTION_FERNET_KEYS=keys_dict):
            field = EncryptedField()

            # Try to decrypt data that was "encrypted" with a missing key
            fake_encrypted_data = base64.b64encode(b"fake data").decode("ascii")
            formatted_value = f"{MARKER_FERNET}:missing_key:{fake_encrypted_data}"

            # Should fall back to returning the original value when key is missing
            result = field.to_python(formatted_value)
            assert result == formatted_value  # Should return the original encrypted string
