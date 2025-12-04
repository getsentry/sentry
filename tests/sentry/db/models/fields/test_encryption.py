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
    EncryptedJSONField,
)
from sentry.testutils.helpers import override_options
from sentry.utils import json
from sentry.utils.security.encrypted_field_key_store import FernetKeyStore

ENCRYPTION_METHODS = ("plaintext", "fernet")


@pytest.fixture
def fernet_key():
    return Fernet.generate_key()


@pytest.fixture
def fernet_instance(fernet_key):
    return Fernet(fernet_key)


@pytest.fixture
def fernet_keys_store(fernet_key):
    """Single key for testing. Mocks the FernetKeyStore._keys attribute."""
    key_id = "key_id_1"
    original_keys = FernetKeyStore._keys
    original_is_loaded = FernetKeyStore._is_loaded

    # Mock the key store
    FernetKeyStore._keys = {key_id: Fernet(fernet_key)}
    FernetKeyStore._is_loaded = True

    yield key_id, fernet_key

    # Restore original state
    FernetKeyStore._keys = original_keys
    FernetKeyStore._is_loaded = original_is_loaded


@pytest.fixture
def multi_fernet_keys_store():
    """Multiple keys for testing key rotation. Mocks the FernetKeyStore._keys attribute."""
    key1 = Fernet.generate_key()
    key2 = Fernet.generate_key()
    keys_dict = {
        "key_primary": Fernet(key1),
        "key_secondary": Fernet(key2),
    }

    original_keys = FernetKeyStore._keys
    original_is_loaded = FernetKeyStore._is_loaded

    # Mock the key store
    FernetKeyStore._keys = keys_dict
    FernetKeyStore._is_loaded = True

    yield {"key_primary": key1, "key_secondary": key2}

    # Restore original state
    FernetKeyStore._keys = original_keys
    FernetKeyStore._is_loaded = original_is_loaded


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


class EncryptedFieldModel(models.Model):
    id = models.AutoField(primary_key=True)
    data = EncryptedCharField(null=True, blank=True)

    class Meta:
        app_label = "fixtures"


@pytest.mark.django_db
def test_encrypted_char_field_fernet_end_to_end(fernet_keys_store):
    """Test complete save/retrieve cycle with EncryptedField."""
    key_id, _fernet_key = fernet_keys_store

    with (
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": key_id}),
        override_options({"database.encryption.method": "fernet"}),
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
    with override_options({"database.encryption.method": "plaintext"}):
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
    with override_options({"database.encryption.method": "plaintext"}):
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


# EncryptedJSONField Tests


def test_encrypted_json_field_plaintext_encryption():
    """Test EncryptedJSONField encryption with plaintext method."""
    with override_options({"database.encryption.method": "plaintext"}):
        field = EncryptedJSONField()

        test_data = {"key": "value", "nested": {"data": [1, 2, 3]}}
        encrypted = field.get_prep_value(test_data)

        # Should be a dict (will be stored as jsonb)
        assert isinstance(encrypted, dict)
        assert EncryptedJSONField._encrypted_field_key in encrypted
        assert encrypted[EncryptedJSONField._encrypted_field_key].startswith(MARKER_PLAINTEXT)

        # Decrypt and verify
        decrypted = field.to_python(encrypted)
        assert decrypted == test_data


def test_encrypted_json_field_fernet_encryption(fernet_keys_store):
    """Test EncryptedJSONField encryption with Fernet method."""
    key_id, _ = fernet_keys_store

    with (
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": key_id}),
        override_options({"database.encryption.method": "fernet"}),
    ):
        field = EncryptedJSONField()

        test_data = {"user": "john", "email": "john@example.com", "age": 30}
        encrypted = field.get_prep_value(test_data)

        # Should be a dict (will be stored as jsonb)
        assert isinstance(encrypted, dict)
        assert EncryptedJSONField._encrypted_field_key in encrypted
        assert encrypted[EncryptedJSONField._encrypted_field_key].startswith(MARKER_FERNET)

        # Decrypt and verify
        decrypted = field.to_python(encrypted)
        assert decrypted == test_data


@pytest.mark.parametrize("encryption_method", ENCRYPTION_METHODS)
@pytest.mark.parametrize(
    "test_value",
    [
        {"simple": "dict"},
        {"nested": {"data": {"deep": "value"}}},
        {"list": [1, 2, 3, 4, 5]},
        {"mixed": [{"a": 1}, {"b": 2}]},
        {"unicode": "你好世界"},
        {"special": "!@#$%^&*()"},
        {},
        {"empty_string": ""},
        {"null_value": None},
        {"boolean": True},
        {"numbers": 123.456},
        # test case when JSON contains encrypted field key used to store it
        {EncryptedJSONField._encrypted_field_key: "value"},
    ],
)
def test_encrypted_json_field_roundtrip(encryption_method, test_value, fernet_keys_store):
    """Test that JSON encryption and decryption work correctly in roundtrip."""
    key_id, _ = fernet_keys_store

    with (
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": key_id}),
        override_options({"database.encryption.method": encryption_method}),
    ):
        field = EncryptedJSONField()

        encrypted = field.get_prep_value(test_value)
        decrypted = field.to_python(encrypted)

        assert decrypted == test_value


def test_encrypted_json_field_fallback_unencrypted():
    """Test that EncryptedJSONField falls back to unencrypted JSON."""
    field = EncryptedJSONField()

    # Simulate unencrypted JSON data already in the database (as dict from jsonb)
    unencrypted_data = {"legacy": "data", "from": "migration"}

    # Should be able to read it without encryption
    decrypted = field.to_python(unencrypted_data)
    assert decrypted == {"legacy": "data", "from": "migration"}


def test_encrypted_json_field_fallback_with_similar_structure():
    """Test fallback when JSON has similar but not exact encryption structure."""
    field = EncryptedJSONField()

    # Data that has the key but is not our encryption format (has extra keys)
    similar_data = {EncryptedJSONField._encrypted_field_key: "regular_value", "other": "data"}

    # Should return as-is since it doesn't match our exact structure (has extra keys)
    decrypted = field.to_python(similar_data)
    assert decrypted == {EncryptedJSONField._encrypted_field_key: "regular_value", "other": "data"}


class EncryptedJSONFieldModel(models.Model):
    id = models.AutoField(primary_key=True)
    data = EncryptedJSONField(null=True, blank=True)

    class Meta:
        app_label = "fixtures"


@pytest.mark.django_db
def test_encrypted_json_field_fernet_end_to_end(fernet_keys_store):
    """Test complete save/retrieve cycle with EncryptedJSONField and Fernet."""
    key_id, _fernet_key = fernet_keys_store

    with (
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": key_id}),
        override_options({"database.encryption.method": "fernet"}),
    ):
        test_data = {
            "sensitive": "data",
            "user": {"id": 123, "email": "user@example.com"},
            "tokens": ["token1", "token2"],
        }

        model_instance = EncryptedJSONFieldModel.objects.create(data=test_data)
        assert model_instance.id is not None

        # Verify the data was correctly encrypted and decrypted
        retrieved_instance = EncryptedJSONFieldModel.objects.get(id=model_instance.id)
        assert retrieved_instance.data == test_data

        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT data FROM fixtures_encryptedjsonfieldmodel WHERE id = %s",
                [model_instance.id],
            )
            raw_value = cursor.fetchone()[0]

            # raw_value is a string and needs to be parsed
            json_value = json.loads(raw_value)
            assert EncryptedJSONField._encrypted_field_key in json_value
            assert json_value["sentry_encrypted_field_value"].startswith(MARKER_FERNET)

            assert "sensitive" not in raw_value
            assert "user@example.com" not in raw_value


@pytest.mark.django_db
def test_encrypted_json_field_plaintext_end_to_end():
    """Test complete save/retrieve cycle with EncryptedJSONField and plaintext."""
    with override_options({"database.encryption.method": "plaintext"}):
        test_data = {"plain": "data", "numbers": [1, 2, 3]}

        model_instance = EncryptedJSONFieldModel.objects.create(data=test_data)
        assert model_instance.id is not None

        # Verify the data was correctly encrypted and decrypted
        retrieved_instance = EncryptedJSONFieldModel.objects.get(id=model_instance.id)
        assert retrieved_instance.data == test_data

        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT data FROM fixtures_encryptedjsonfieldmodel WHERE id = %s",
                [model_instance.id],
            )
            raw_value = cursor.fetchone()[0]

            json_value = json.loads(raw_value)
            assert "sentry_encrypted_field_value" in json_value
            assert json_value["sentry_encrypted_field_value"].startswith(MARKER_PLAINTEXT)


@pytest.mark.django_db
def test_encrypted_json_field_migration_compatibility(fernet_keys_store):
    """Test that EncryptedJSONField can read unencrypted legacy data."""
    key_id, _fernet_key = fernet_keys_store

    legacy_data = {"legacy": True, "migrated": False}

    with connection.cursor() as cursor:
        cursor.execute(
            "INSERT INTO fixtures_encryptedjsonfieldmodel (data) VALUES (%s::jsonb) RETURNING id",
            [json.dumps(legacy_data)],
        )
        inserted_id = cursor.fetchone()[0]

    # Now try to read it with EncryptedJSONField
    with (
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": key_id}),
        override_options({"database.encryption.method": "fernet"}),
    ):
        retrieved_instance = EncryptedJSONFieldModel.objects.get(id=inserted_id)

        # Should fall back to reading unencrypted data
        assert retrieved_instance.data == legacy_data

        # Now update it - should encrypt on save
        retrieved_instance.data = {"legacy": True, "migrated": True}
        retrieved_instance.save()

        # Verify it's now encrypted
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT data FROM fixtures_encryptedjsonfieldmodel WHERE id = %s",
                [inserted_id],
            )
            raw_value = cursor.fetchone()[0]

            # raw_value is a string
            json_value = json.loads(raw_value)
            assert "sentry_encrypted_field_value" in json_value
            assert json_value["sentry_encrypted_field_value"].startswith(MARKER_FERNET)


@pytest.mark.django_db
def test_encrypted_json_field_fake_encrypted_format_fallback(fernet_keys_store):
    """
    Test that EncryptedJSONField falls back gracefully when data has the encrypted
    wrapper structure but contains non-encrypted plain text values.

    This simulates a scenario where data was manually inserted or corrupted to look
    like encrypted data but is actually just plain text.
    """
    key_id, _fernet_key = fernet_keys_store

    # Directly insert a value that looks like our encrypted format but isn't actually encrypted
    fake_encrypted_data = {
        EncryptedJSONField._encrypted_field_key: "this is just plain text, not encrypted"
    }

    with connection.cursor() as cursor:
        cursor.execute(
            "INSERT INTO fixtures_encryptedjsonfieldmodel (data) VALUES (%s::jsonb) RETURNING id",
            [json.dumps(fake_encrypted_data)],
        )
        inserted_id = cursor.fetchone()[0]

    # Try to read it back with EncryptedJSONField
    with (
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": key_id}),
        override_options({"database.encryption.method": "fernet"}),
    ):
        retrieved_instance = EncryptedJSONFieldModel.objects.get(id=inserted_id)

        # Should fall back to returning the original structure since decryption fails
        assert retrieved_instance.data == fake_encrypted_data

    # Test with a value that looks more like our encrypted format but still isn't valid
    fake_fernet_like = {
        EncryptedJSONField._encrypted_field_key: f"{MARKER_FERNET}:some_key:not_real_encrypted_data"
    }

    with connection.cursor() as cursor:
        cursor.execute(
            "INSERT INTO fixtures_encryptedjsonfieldmodel (data) VALUES (%s::jsonb) RETURNING id",
            [json.dumps(fake_fernet_like)],
        )
        inserted_id = cursor.fetchone()[0]

    with (
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": key_id}),
        override_options({"database.encryption.method": "fernet"}),
    ):
        retrieved_instance = EncryptedJSONFieldModel.objects.get(id=inserted_id)

        # Should fall back to returning the original structure
        assert retrieved_instance.data == fake_fernet_like
