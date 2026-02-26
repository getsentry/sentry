import secrets

import pytest
from django.db import connection, models
from django.test import override_settings

from sentry.db.models.fields.encryption import EncryptedTextField
from sentry.db.models.fields.encryption._base import MARKER_FERNET, MARKER_PLAINTEXT
from sentry.testutils.helpers import override_options


class EncryptedTextFieldModel(models.Model):
    id = models.AutoField(primary_key=True)
    data = EncryptedTextField(null=True, blank=True)

    class Meta:
        app_label = "fixtures"


def generate_secret():
    """Callable default similar to ApiApplication.generate_token."""
    return secrets.token_hex(nbytes=32)


class EncryptedTextFieldWithDefaultModel(models.Model):
    id = models.AutoField(primary_key=True)
    secret = EncryptedTextField(default=generate_secret)
    static_default = EncryptedTextField(default="static_value")

    class Meta:
        app_label = "fixtures"


@pytest.mark.django_db
def test_encrypted_text_field_default_method():
    """Test that EncryptedTextField works with the default encryption method (plaintext)."""
    test_data = "This is sensitive data using default encryption method"

    model_instance = EncryptedTextFieldModel.objects.create(data=test_data)
    assert model_instance.id is not None

    # Verify the data was correctly stored and retrieved
    retrieved_instance = EncryptedTextFieldModel.objects.get(id=model_instance.id)
    assert retrieved_instance.data == test_data

    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT data FROM fixtures_encryptedtextfieldmodel WHERE id = %s",
            [model_instance.id],
        )
        raw_value = cursor.fetchone()[0]
        # Default method is plaintext, so should be in format enc:plaintext:base64data
        assert raw_value.startswith(f"{MARKER_PLAINTEXT}:")
        assert test_data not in raw_value


@pytest.mark.django_db
def test_encrypted_text_field_fernet_end_to_end(fernet_keys_store):
    """Test complete save/retrieve cycle with EncryptedTextField using fernet."""
    key_id, _fernet_key = fernet_keys_store

    with (
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": key_id}),
        override_options({"database.encryption.method": "fernet"}),
    ):
        test_data = "This is sensitive data that should be encrypted"

        model_instance = EncryptedTextFieldModel.objects.create(data=test_data)
        assert model_instance.id is not None

        # Verify the data was correctly encrypted and decrypted
        retrieved_instance = EncryptedTextFieldModel.objects.get(id=model_instance.id)
        assert retrieved_instance.data == test_data

        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT data FROM fixtures_encryptedtextfieldmodel WHERE id = %s",
                [model_instance.id],
            )
            raw_value = cursor.fetchone()[0]

            # Should be in fernet format: enc:fernet:key_id:base64data
            assert raw_value.startswith(f"{MARKER_FERNET}:")
            assert test_data not in raw_value


@pytest.mark.django_db
def test_encrypted_text_field_plaintext_end_to_end():
    """Test complete save/retrieve cycle with EncryptedTextField using plaintext."""
    with override_options({"database.encryption.method": "plaintext"}):
        test_data = "This is plain text data"

        model_instance = EncryptedTextFieldModel.objects.create(data=test_data)
        assert model_instance.id is not None

        # Verify the data was correctly encrypted and decrypted
        retrieved_instance = EncryptedTextFieldModel.objects.get(id=model_instance.id)
        assert retrieved_instance.data == test_data

        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT data FROM fixtures_encryptedtextfieldmodel WHERE id = %s",
                [model_instance.id],
            )
            # Should be in a format enc:plaintext:base64data
            raw_value = cursor.fetchone()[0]
            assert raw_value.startswith(f"{MARKER_PLAINTEXT}:")
            assert test_data not in raw_value


@pytest.mark.django_db
def test_encrypted_text_field_null_value():
    """Test that null values are handled correctly."""
    with override_options({"database.encryption.method": "plaintext"}):
        model_instance = EncryptedTextFieldModel.objects.create(data=None)
        assert model_instance.id is not None

        retrieved_instance = EncryptedTextFieldModel.objects.get(id=model_instance.id)
        assert retrieved_instance.data is None

        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT data FROM fixtures_encryptedtextfieldmodel WHERE id = %s",
                [model_instance.id],
            )
            raw_value = cursor.fetchone()[0]
            assert raw_value is None


@pytest.mark.django_db
def test_encrypted_text_field_long_text():
    """Test that EncryptedTextField handles long text correctly (TextField behavior)."""
    with override_options({"database.encryption.method": "plaintext"}):
        # Create a long text that would exceed typical varchar limits
        test_data = "A" * 10000

        model_instance = EncryptedTextFieldModel.objects.create(data=test_data)
        assert model_instance.id is not None

        retrieved_instance = EncryptedTextFieldModel.objects.get(id=model_instance.id)
        assert retrieved_instance.data == test_data
        assert len(retrieved_instance.data) == 10000


@pytest.mark.django_db
def test_encrypted_text_field_empty_string():
    """Test that empty strings are handled correctly."""
    with override_options({"database.encryption.method": "plaintext"}):
        model_instance = EncryptedTextFieldModel.objects.create(data="")
        assert model_instance.id is not None

        retrieved_instance = EncryptedTextFieldModel.objects.get(id=model_instance.id)
        assert retrieved_instance.data == ""


@pytest.mark.django_db
def test_encrypted_text_field_with_callable_default():
    """Test that EncryptedTextField works with a callable default (like generate_token)."""
    with override_options({"database.encryption.method": "plaintext"}):
        # Create instance without providing 'secret' - should use callable default
        model_instance = EncryptedTextFieldWithDefaultModel.objects.create()
        assert model_instance.id is not None

        # The secret should be auto-generated (64 hex chars from 32 bytes)
        assert model_instance.secret is not None
        assert len(model_instance.secret) == 64

        # Verify it's stored encrypted and retrieved correctly
        retrieved_instance = EncryptedTextFieldWithDefaultModel.objects.get(id=model_instance.id)
        assert retrieved_instance.secret == model_instance.secret

        # Verify it's actually encrypted in the database
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT secret FROM fixtures_encryptedtextfieldwithdefaultmodel WHERE id = %s",
                [model_instance.id],
            )
            raw_value = cursor.fetchone()[0]
            assert raw_value.startswith(f"{MARKER_PLAINTEXT}:")
            assert model_instance.secret not in raw_value


@pytest.mark.django_db
def test_encrypted_text_field_with_static_default():
    """Test that EncryptedTextField works with a static default value."""
    with override_options({"database.encryption.method": "plaintext"}):
        # Create instance without providing 'static_default' - should use static default
        model_instance = EncryptedTextFieldWithDefaultModel.objects.create()
        assert model_instance.id is not None

        assert model_instance.static_default == "static_value"

        # Verify it's stored encrypted and retrieved correctly
        retrieved_instance = EncryptedTextFieldWithDefaultModel.objects.get(id=model_instance.id)
        assert retrieved_instance.static_default == "static_value"

        # Verify it's actually encrypted in the database
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT static_default FROM fixtures_encryptedtextfieldwithdefaultmodel WHERE id = %s",
                [model_instance.id],
            )
            raw_value = cursor.fetchone()[0]
            assert raw_value.startswith(f"{MARKER_PLAINTEXT}:")
            assert "static_value" not in raw_value


@pytest.mark.django_db
def test_encrypted_text_field_callable_default_generates_unique_values():
    """Test that callable default generates unique values for each instance."""
    with override_options({"database.encryption.method": "plaintext"}):
        instance1 = EncryptedTextFieldWithDefaultModel.objects.create()
        instance2 = EncryptedTextFieldWithDefaultModel.objects.create()

        # Each instance should have a unique secret
        assert instance1.secret != instance2.secret


@pytest.mark.django_db
def test_encrypted_text_field_default_with_fernet(fernet_keys_store):
    """Test that default values work correctly with fernet encryption."""
    key_id, _fernet_key = fernet_keys_store

    with (
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": key_id}),
        override_options({"database.encryption.method": "fernet"}),
    ):
        model_instance = EncryptedTextFieldWithDefaultModel.objects.create()
        assert model_instance.id is not None

        # Verify callable default
        assert model_instance.secret is not None
        assert len(model_instance.secret) == 64

        # Verify static default
        assert model_instance.static_default == "static_value"

        # Verify retrieval
        retrieved_instance = EncryptedTextFieldWithDefaultModel.objects.get(id=model_instance.id)
        assert retrieved_instance.secret == model_instance.secret
        assert retrieved_instance.static_default == "static_value"

        # Verify encryption in database
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT secret, static_default FROM fixtures_encryptedtextfieldwithdefaultmodel WHERE id = %s",
                [model_instance.id],
            )
            raw_secret, raw_static = cursor.fetchone()
            assert raw_secret.startswith(f"{MARKER_FERNET}:")
            assert raw_static.startswith(f"{MARKER_FERNET}:")
