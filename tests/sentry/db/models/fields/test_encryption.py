import base64
from unittest.mock import patch

import pytest
from cryptography.fernet import Fernet
from django.db import models
from django.test import override_settings

from sentry.db.models.fields.encryption import (
    EncryptedCharField,
    EncryptedEmailField,
    EncryptedTextField,
)
from sentry.testutils.cases import TestCase


class TestModel(models.Model):
    encrypted_char = EncryptedCharField(max_length=255)
    encrypted_text = EncryptedTextField()
    encrypted_email = EncryptedEmailField()

    class Meta:
        app_label = 'tests'


class EncryptedFieldTest(TestCase):
    def setUp(self):
        super().setUp()
        # Generate a valid Fernet key
        self.fernet_key = Fernet.generate_key()
        self.fernet = Fernet(self.fernet_key)

    def test_plain_text_encryption(self):
        """Test that plain_text mode stores values as-is."""
        with self.options({'database.encryption.method': 'plain_text'}):
            field = EncryptedCharField()

            # Test encryption (should return plain text)
            encrypted = field.get_prep_value("test value")
            assert encrypted == "test value"

            # Test decryption (should return as-is)
            decrypted = field.from_db_value("test value", None, None)
            assert decrypted == "test value"

    @override_settings(DATABASE_ENCRYPTION_FERNET_KEY=None)
    def test_fernet_encryption_without_key(self):
        """Test that Fernet encryption falls back to plain text without key."""
        with self.options({'database.encryption.method': 'fernet'}):
            field = EncryptedCharField()

            # Should fall back to plain text
            encrypted = field.get_prep_value("test value")
            assert encrypted == "test value"

    def test_fernet_encryption_with_key(self):
        """Test Fernet encryption with a valid key."""
        with self.options({'database.encryption.method': 'fernet'}):
            with override_settings(DATABASE_ENCRYPTION_FERNET_KEY=self.fernet_key):
                field = EncryptedCharField()

                # Test encryption
                encrypted = field.get_prep_value("test value")
                assert encrypted.startswith("fernet:")

                # Extract the encrypted part and verify it's valid base64
                _, encrypted_data = encrypted.split(":", 1)
                base64.urlsafe_b64decode(encrypted_data)

                # Test decryption
                decrypted = field.from_db_value(encrypted, None, None)
                assert decrypted == "test value"

    def test_encryption_method_switching(self):
        """Test that values can be decrypted after switching encryption methods."""
        # First, encrypt with Fernet
        with self.options({'database.encryption.method': 'fernet'}):
            with override_settings(DATABASE_ENCRYPTION_FERNET_KEY=self.fernet_key):
                field = EncryptedCharField()
                encrypted_fernet = field.get_prep_value("fernet encrypted")

        # Then, encrypt with plain text
        with self.options({'database.encryption.method': 'plain_text'}):
            field = EncryptedCharField()
            encrypted_plain = field.get_prep_value("plain text value")

        # Switch to fernet and verify both can be decrypted
        with self.options({'database.encryption.method': 'fernet'}):
            with override_settings(DATABASE_ENCRYPTION_FERNET_KEY=self.fernet_key):
                field = EncryptedCharField()

                # Should decrypt fernet value
                decrypted_fernet = field.from_db_value(encrypted_fernet, None, None)
                assert decrypted_fernet == "fernet encrypted"

                # Should also handle plain text (fallback)
                decrypted_plain = field.from_db_value(encrypted_plain, None, None)
                assert decrypted_plain == "plain text value"

    def test_invalid_fernet_key(self):
        """Test handling of invalid Fernet keys."""
        with self.options({'database.encryption.method': 'fernet'}):
            with override_settings(DATABASE_ENCRYPTION_FERNET_KEY="invalid-key"):
                field = EncryptedCharField()

                # Should fall back to plain text
                encrypted = field.get_prep_value("test value")
                assert encrypted == "test value"

    def test_different_field_types(self):
        """Test that different encrypted field types work correctly."""
        with self.options({'database.encryption.method': 'fernet'}):
            with override_settings(DATABASE_ENCRYPTION_FERNET_KEY=self.fernet_key):
                # Test EncryptedTextField
                text_field = EncryptedTextField()
                long_text = "This is a very long text " * 100
                encrypted_text = text_field.get_prep_value(long_text)
                decrypted_text = text_field.from_db_value(encrypted_text, None, None)
                assert decrypted_text == long_text

                # Test EncryptedEmailField
                email_field = EncryptedEmailField()
                email = "test@example.com"
                encrypted_email = email_field.get_prep_value(email)
                decrypted_email = email_field.from_db_value(encrypted_email, None, None)
                assert decrypted_email == email

    def test_none_value_handling(self):
        """Test that None values are handled correctly."""
        with self.options({'database.encryption.method': 'fernet'}):
            with override_settings(DATABASE_ENCRYPTION_FERNET_KEY=self.fernet_key):
                field = EncryptedCharField()

                # Test None encryption
                encrypted = field.get_prep_value(None)
                assert encrypted is None

                # Test None decryption
                decrypted = field.from_db_value(None, None, None)
                assert decrypted is None

    def test_keysets_not_implemented(self):
        """Test that keysets method raises NotImplementedError."""
        with self.options({'database.encryption.method': 'keysets'}):
            field = EncryptedCharField()

            with pytest.raises(NotImplementedError, match="Keysets encryption not yet implemented"):
                field.get_prep_value("test value")

    def test_fernet_prefix_handling(self):
        """Test that the fernet: prefix is handled correctly."""
        with self.options({'database.encryption.method': 'fernet'}):
            with override_settings(DATABASE_ENCRYPTION_FERNET_KEY=self.fernet_key):
                field = EncryptedCharField()

                # Create a value with fernet prefix
                test_value = "test value"
                encrypted = field.get_prep_value(test_value)

                # Verify it has the prefix
                assert encrypted.startswith("fernet:")

                # Test that decryption works with prefix
                decrypted = field.from_db_value(encrypted, None, None)
                assert decrypted == test_value

    def test_legacy_data_without_prefix(self):
        """Test handling of legacy encrypted data without method prefix."""
        with self.options({'database.encryption.method': 'plain_text'}):
            field = EncryptedCharField()

            # Simulate legacy plain text data
            legacy_value = "legacy plain text"
            decrypted = field.from_db_value(legacy_value, None, None)
            assert decrypted == legacy_value

    def test_to_python_conversion(self):
        """Test the to_python method."""
        field = EncryptedCharField()

        # Test string
        assert field.to_python("test") == "test"

        # Test None
        assert field.to_python(None) is None

        # Test non-string
        assert field.to_python(123) == "123"
        assert field.to_python(True) == "True"
