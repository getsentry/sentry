import pytest
from django.db import connection, models
from django.test import override_settings

from sentry.db.models.fields.encryption import EncryptedJSONField
from sentry.db.models.fields.encryption._base import MARKER_FERNET, MARKER_PLAINTEXT
from sentry.testutils.helpers import override_options
from sentry.utils import json

ENCRYPTION_METHODS = ("plaintext", "fernet")


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
