from unittest.mock import patch

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


@pytest.mark.django_db
def test_encrypted_char_field_metrics_on_encrypt():
    """Test that encryption sends metrics with correct tags including table_name."""
    with (
        override_options({"database.encryption.method": "plaintext"}),
        patch("sentry.db.models.fields.encryption._base.metrics") as mock_metrics,
    ):
        test_data = "test data for metrics"
        EncryptedFieldModel.objects.create(data=test_data)

        # Verify timer was called
        mock_metrics.timer.assert_called_once()
        timer_call = mock_metrics.timer.call_args
        assert timer_call[0][0] == "database.encrypted_field.encrypt.duration"
        timer_tags = timer_call[1]["tags"]
        assert timer_tags["method"] == "plaintext"
        assert timer_tags["field_type"] == "EncryptedCharField"
        assert timer_tags["table_name"] == "EncryptedFieldModel"

        # Verify incr was called for success
        mock_metrics.incr.assert_called_once()
        incr_call = mock_metrics.incr.call_args
        assert incr_call[0][0] == "database.encrypted_field.encrypt"
        incr_tags = incr_call[1]["tags"]
        assert incr_tags["method"] == "plaintext"
        assert incr_tags["field_type"] == "EncryptedCharField"
        assert incr_tags["table_name"] == "EncryptedFieldModel"
        assert incr_tags["status"] == "success"


@pytest.mark.django_db
def test_encrypted_char_field_metrics_on_decrypt(fernet_keys_store):
    """Test that decryption sends metrics with correct tags including table_name."""
    key_id, _fernet_key = fernet_keys_store

    with (
        override_settings(DATABASE_ENCRYPTION_SETTINGS={"fernet_primary_key_id": key_id}),
        override_options({"database.encryption.method": "fernet"}),
    ):
        test_data = "test data for decrypt metrics"
        model_instance = EncryptedFieldModel.objects.create(data=test_data)

    # Now retrieve with metrics mocked
    with patch("sentry.db.models.fields.encryption._base.metrics") as mock_metrics:
        EncryptedFieldModel.objects.get(id=model_instance.id)

        # Verify timer was called for decrypt
        mock_metrics.timer.assert_called_once()
        timer_call = mock_metrics.timer.call_args
        assert timer_call[0][0] == "database.encrypted_field.decrypt.duration"
        timer_tags = timer_call[1]["tags"]
        assert timer_tags["method"] == "fernet"
        assert timer_tags["field_type"] == "EncryptedCharField"
        assert timer_tags["table_name"] == "EncryptedFieldModel"
        assert timer_tags["marker"] == MARKER_FERNET

        # Verify incr was called for success
        mock_metrics.incr.assert_called_once()
        incr_call = mock_metrics.incr.call_args
        assert incr_call[0][0] == "database.encrypted_field.decrypt"
        incr_tags = incr_call[1]["tags"]
        assert incr_tags["method"] == "fernet"
        assert incr_tags["field_type"] == "EncryptedCharField"
        assert incr_tags["table_name"] == "EncryptedFieldModel"
        assert incr_tags["status"] == "success"
