import pytest
from django.db import connection, models
from django.test import override_settings

from sentry.db.models.fields.encryption import EncryptedCharField
from sentry.db.models.fields.encryption._base import MARKER_FERNET, MARKER_PLAINTEXT
from sentry.testutils.helpers import override_options


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
