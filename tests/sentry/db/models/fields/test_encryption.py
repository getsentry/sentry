import base64

import pytest
from cryptography.fernet import Fernet
from django.db import connection, models
from django.test import override_settings

from sentry.db.models.fields.encryption import (
    MARKER_FERNET,
    MARKER_PLAINTEXT,
    EncryptedCharField,
    EncryptedField,
)
from sentry.testutils.helpers.options import override_options

ENCRYPTION_METHODS = ("plaintext", "fernet")


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
            first_key = list(multi_fernet_keys_value.values())[0]
            fernet_instance = Fernet(first_key.encode())
            decrypted_bytes = fernet_instance.decrypt(fernet_data)
            assert decrypted_bytes == b"test value"

            # Test decryption through field
            decrypted = field.to_python(encrypted)
            assert decrypted == b"test value"


def test_fernet_key_rotation(multi_fernet_keys_value):
    """Test that data encrypted with different keys can be decrypted."""
    with override_options({"database.encryption.method": "fernet"}):
        with override_settings(DATABASE_ENCRYPTION_FERNET_KEYS=multi_fernet_keys_value):
            field = EncryptedField()

            # Encrypt some data
            encrypted_value = field.get_prep_value("test data")

            # Should be able to decrypt it
            decrypted_value = field.to_python(encrypted_value)
            assert decrypted_value == b"test data"

            # Manually create encrypted data with the second key
            second_key_id = list(multi_fernet_keys_value.keys())[1]
            second_key = multi_fernet_keys_value[second_key_id]
            fernet_instance = Fernet(second_key.encode())
            manual_encrypted = fernet_instance.encrypt(b"second key data")
            manual_encoded = base64.b64encode(manual_encrypted).decode("ascii")
            manual_formatted = f"{MARKER_FERNET}:{second_key_id}:{manual_encoded}"

            # Should be able to decrypt data encrypted with the second key
            decrypted_manual = field.to_python(manual_formatted)
            assert decrypted_manual == b"second key data"


def test_fernet_format_without_key_id_rejected(fernet_keys_value):
    """Test that Fernet format without key_id is rejected."""
    with override_options({"database.encryption.method": "fernet"}):
        with override_settings(DATABASE_ENCRYPTION_FERNET_KEYS=fernet_keys_value):
            field = EncryptedField()

            # Create invalid format without key_id
            key = list(fernet_keys_value.values())[0]
            fernet_instance = Fernet(key.encode())
            encrypted_data = fernet_instance.encrypt(b"test data")
            encoded_data = base64.b64encode(encrypted_data).decode("ascii")
            invalid_format = f"{MARKER_FERNET}:{encoded_data}"

            # Should return the original value as it's invalid format
            result = field.to_python(invalid_format)
            assert result == invalid_format


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
    with override_options({"database.encryption.method": "plaintext"}):
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
            assert decrypted_fernet == b"fernet encrypted"

            # Should also handle plain text (fallback)
            decrypted_plain = field.to_python(encrypted_plain)
            assert decrypted_plain == b"plain text value"


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
            assert len(parts) == 4
            enc, method, key_id, _encoded_data = parts
            assert f"{enc}:{method}" == MARKER_FERNET
            assert key_id == "key1"  # First key in dict

            # Should be able to decrypt
            decrypted = field.to_python(encrypted)
            assert decrypted == b"test value"


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


@pytest.mark.parametrize(
    "key_id,key_value,expected_error_match",
    [
        (
            "",
            "valid_key",
            r"DATABASE_ENCRYPTION_FERNET_KEYS has invalid key_id or key \(, valid_key\)",
        ),
        (
            None,
            "valid_key",
            r"DATABASE_ENCRYPTION_FERNET_KEYS has invalid key_id or key \(None, valid_key\)",
        ),
        (
            "valid_key_id",
            "",
            r"DATABASE_ENCRYPTION_FERNET_KEYS has invalid key_id or key \(valid_key_id, \)",
        ),
        (
            "valid_key_id",
            None,
            r"DATABASE_ENCRYPTION_FERNET_KEYS has invalid key_id or key \(valid_key_id, None\)",
        ),
    ],
)
def test_fernet_invalid_key_id_or_key_values(key_id, key_value, expected_error_match):
    """Test handling of None or empty key_id or key values in the keys dictionary."""
    with override_options({"database.encryption.method": "fernet"}):
        field = EncryptedField()

        with override_settings(DATABASE_ENCRYPTION_FERNET_KEYS={key_id: key_value}):
            with pytest.raises(ValueError, match=expected_error_match):
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


def test_fernet_marker_handling(fernet_keys_value):
    """Test that the fernet marker is handled correctly."""
    with override_options({"database.encryption.method": "fernet"}):
        with override_settings(DATABASE_ENCRYPTION_FERNET_KEYS=fernet_keys_value):
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
        b"bytes data",
        b"invalid utf-8: \xc0",
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

            if test_value is None:
                assert decrypted is None
            elif isinstance(test_value, str):
                assert decrypted == test_value.encode("utf-8")
            else:
                assert decrypted == test_value


def test_marker_format_consistency(fernet_keys_value):
    """Test that the marker format is consistent across methods."""
    field = EncryptedField()

    with override_options({"database.encryption.method": "plaintext"}):
        encrypted = field.get_prep_value("test")
        assert encrypted is not None
        assert encrypted.startswith(f"{MARKER_PLAINTEXT}:")

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


def test_fernet_format_with_plaintext_data(fernet_keys_value):
    """Test that data in fernet format but containing plain text (not encrypted) falls back correctly."""
    with override_options({"database.encryption.method": "fernet"}):
        with override_settings(DATABASE_ENCRYPTION_FERNET_KEYS=fernet_keys_value):
            field = EncryptedField()

            # Create data that looks like fernet format but contains plain text instead of encrypted data
            # This could happen during migration from plain text to encrypted storage
            plaintext_content = "this is just plain text, not encrypted"
            fake_fernet_data = f"{MARKER_FERNET}:key_id_1:{plaintext_content}"

            # Should fall back to returning the original string since it's not valid encrypted data
            result = field.to_python(fake_fernet_data)
            assert result == fake_fernet_data  # Should return the original string as-is

            # Test with a format that has valid base64 but invalid fernet data
            fake_base64_data = base64.b64encode(b"not fernet encrypted").decode("ascii")
            fake_fernet_with_base64 = f"{MARKER_FERNET}:key_id_1:{fake_base64_data}"

            result = field.to_python(fake_fernet_with_base64)
            # This should also fall back to the original string since it's not valid Fernet data
            assert result == fake_fernet_with_base64


class EncryptedFieldModel(models.Model):
    id = models.AutoField(primary_key=True)
    data = EncryptedCharField(null=True, blank=True)

    class Meta:
        app_label = "fixtures"


@pytest.mark.django_db
def test_encrypted_char_field_fernet_end_to_end(fernet_keys_value):
    """Test complete save/retrieve cycle with EncryptedField."""

    with (
        override_options({"database.encryption.method": "fernet"}),
        override_settings(DATABASE_ENCRYPTION_FERNET_KEYS=fernet_keys_value),
    ):
        test_data = "This is sensitive data that should be encrypted"

        model_instance = EncryptedFieldModel.objects.create(data=test_data)
        assert model_instance.id is not None

        # Verify the data was correctly encrypted and decrypted
        retrieved_instance = EncryptedFieldModel.objects.get(id=model_instance.id)
        assert retrieved_instance.data == test_data

        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT data FROM fixtures_encryptedfieldmodel WHERE id = %s",
                [model_instance.id],
            )
            raw_value = cursor.fetchone()[0]

            # Should be in fernet format: enc:fernet:key_id:base64data
            assert raw_value.startswith(f"{MARKER_FERNET}:")
            assert test_data not in raw_value


@pytest.mark.django_db
def test_encrypted_char_field_plaintext_end_to_end():
    """Test complete save/retrieve cycle with EncryptedCharField."""
    test_data = "This is plain text data"

    model_instance = EncryptedFieldModel.objects.create(data=test_data)
    assert model_instance.id is not None

    # Verify the data was correctly encrypted and decrypted
    retrieved_instance = EncryptedFieldModel.objects.get(id=model_instance.id)
    assert retrieved_instance.data == test_data

    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT data FROM fixtures_encryptedfieldmodel WHERE id = %s",
            [model_instance.id],
        )
        # Should be in a format enc:plaintext:base64data
        raw_value = cursor.fetchone()[0]
        assert raw_value.startswith(f"{MARKER_PLAINTEXT}:")
        assert test_data not in raw_value


@pytest.mark.django_db
def test_encrypted_char_field_null_value():
    model_instance = EncryptedFieldModel.objects.create(data=None)
    assert model_instance.id is not None

    retrieved_instance = EncryptedFieldModel.objects.get(id=model_instance.id)
    assert retrieved_instance.data is None

    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT data FROM fixtures_encryptedfieldmodel WHERE id = %s",
            [model_instance.id],
        )
        raw_value = cursor.fetchone()[0]
        assert raw_value is None
