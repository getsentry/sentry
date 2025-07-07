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
        """Test that plain_text mode stores values as UTF-8 encoded bytes."""
        with self.options({'database.encryption.method': 'plain_text'}):
            field = EncryptedCharField()

            # Test encryption (should return UTF-8 bytes)
            encrypted = field.get_prep_value("test value")
            assert encrypted == b"test value"
            assert isinstance(encrypted, bytes)

            # Test decryption (should return string)
            decrypted = field.from_db_value(b"test value", None, None)
            assert decrypted == "test value"
            assert isinstance(decrypted, str)

    @override_settings(DATABASE_ENCRYPTION_FERNET_KEY=None)
    def test_fernet_encryption_without_key(self):
        """Test that Fernet encryption falls back to plain text without key."""
        with self.options({'database.encryption.method': 'fernet'}):
            field = EncryptedCharField()

            # Should fall back to plain text bytes
            encrypted = field.get_prep_value("test value")
            assert encrypted == b"test value"

    def test_fernet_encryption_with_key(self):
        """Test Fernet encryption with a valid key."""
        with self.options({'database.encryption.method': 'fernet'}):
            with override_settings(DATABASE_ENCRYPTION_FERNET_KEY=self.fernet_key):
                field = EncryptedCharField()

                # Test encryption
                encrypted = field.get_prep_value("test value")
                assert isinstance(encrypted, bytes)
                assert encrypted is not None
                # Should start with fernet marker byte (0x01)
                assert encrypted[0] == 0x01

                # Verify the rest is valid fernet encrypted data
                fernet_data = encrypted[1:]
                # Should be able to decrypt with fernet
                decrypted_bytes = self.fernet.decrypt(fernet_data)
                assert decrypted_bytes == b"test value"

                # Test decryption through field
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

                # Should fall back to plain text bytes
                encrypted = field.get_prep_value("test value")
                assert encrypted == b"test value"

    def test_different_field_types(self):
        """Test that different encrypted field types work correctly."""
        with self.options({'database.encryption.method': 'fernet'}):
            with override_settings(DATABASE_ENCRYPTION_FERNET_KEY=self.fernet_key):
                # Test EncryptedTextField
                text_field = EncryptedTextField()
                long_text = "This is a very long text " * 100
                encrypted_text = text_field.get_prep_value(long_text)
                assert isinstance(encrypted_text, bytes)
                decrypted_text = text_field.from_db_value(encrypted_text, None, None)
                assert decrypted_text == long_text

                # Test EncryptedEmailField
                email_field = EncryptedEmailField()
                email = "test@example.com"
                encrypted_email = email_field.get_prep_value(email)
                assert isinstance(encrypted_email, bytes)
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

    def test_fernet_marker_handling(self):
        """Test that the fernet marker byte is handled correctly."""
        with self.options({'database.encryption.method': 'fernet'}):
            with override_settings(DATABASE_ENCRYPTION_FERNET_KEY=self.fernet_key):
                field = EncryptedCharField()

                                # Create a value with fernet encryption
                test_value = "test value"
                encrypted = field.get_prep_value(test_value)
                assert encrypted is not None

                # Verify it has the marker byte
                assert encrypted[0] == 0x01

                # Test that decryption works with marker
                decrypted = field.from_db_value(encrypted, None, None)
                assert decrypted == test_value

    def test_legacy_data_without_marker(self):
        """Test handling of legacy encrypted data without method marker."""
        with self.options({'database.encryption.method': 'plain_text'}):
            field = EncryptedCharField()

            # Simulate legacy plain text data (no marker)
            legacy_value = b"legacy plain text"
            decrypted = field.from_db_value(legacy_value, None, None)
            assert decrypted == "legacy plain text"

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

        # Test bytes (should decrypt)
        with self.options({'database.encryption.method': 'plain_text'}):
            assert field.to_python(b"test bytes") == "test bytes"

    def test_char_field_max_length_validation(self):
        """Test that EncryptedCharField validates max_length."""
        field = EncryptedCharField(max_length=10)

        # Should work for values within limit
        result = field.to_python("short")
        assert result == "short"

        # Should raise for values exceeding limit
        with pytest.raises(ValueError, match="Value exceeds max_length of 10"):
            field.to_python("this is too long for the field")

    def test_email_field_validation(self):
        """Test that EncryptedEmailField validates email format."""
        field = EncryptedEmailField()

        # Valid email
        result = field.to_python("test@example.com")
        assert result == "test@example.com"

        # Invalid email
        with pytest.raises(ValueError, match="Invalid email address"):
            field.to_python("not-an-email")

    def test_binary_data_efficiency(self):
        """Test that binary storage is more efficient than base64."""
        with self.options({'database.encryption.method': 'fernet'}):
            with override_settings(DATABASE_ENCRYPTION_FERNET_KEY=self.fernet_key):
                field = EncryptedCharField()

                # Get encrypted data
                test_value = "test value " * 10
                encrypted = field.get_prep_value(test_value)

                                # Compare with base64 encoded version
                # Remove marker byte for fair comparison
                assert encrypted is not None
                encrypted_data = encrypted[1:]
                base64_encoded = base64.urlsafe_b64encode(encrypted_data)

                # Binary storage should be smaller
                assert len(encrypted) < len(base64_encoded)

                # Roughly 25% smaller (base64 adds ~33% overhead)
                ratio = len(encrypted) / len(base64_encoded)
                assert ratio < 0.8  # Should be significantly smaller

    def test_empty_value_handling(self):
        """Test handling of empty strings and bytes."""
        with self.options({'database.encryption.method': 'plain_text'}):
            field = EncryptedCharField()

            # Empty string
            encrypted = field.get_prep_value("")
            assert encrypted == b""
            decrypted = field.from_db_value(b"", None, None)
            assert decrypted == ""

    def test_non_utf8_data_handling(self):
        """Test handling of non-UTF8 data."""
        field = EncryptedCharField()

        # Create invalid UTF-8 bytes
        invalid_utf8 = b'\xff\xfe\xfd'

        # Should return hex representation
        result = field.from_db_value(invalid_utf8, None, None)
        assert result == invalid_utf8.hex()
