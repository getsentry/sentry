from __future__ import annotations

import logging
from typing import Any, Optional

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import models
from django.db.models import BinaryField

from sentry import options

logger = logging.getLogger(__name__)


class EncryptedField(BinaryField):
    """
    A field that supports multiple encryption methods using binary storage.

    Encryption method is controlled via the 'database.encryption.method' option.
    Supported methods:
    - 'plain_text': No encryption (default for development)
    - 'fernet': Fernet symmetric encryption
    - 'keysets': (Future) Google Tink keysets for key rotation

    When decrypting, the field will attempt multiple methods as fallback
    to handle cases where the encryption method was changed.

    Uses BinaryField for efficient storage without base64 encoding overhead.
    """

    def __init__(self, *args, **kwargs):
        # Remove any custom kwargs before passing to parent
        kwargs.pop('max_length', None)  # BinaryField doesn't use max_length
        super().__init__(*args, **kwargs)

    def get_internal_type(self):
        return "BinaryField"

    def get_prep_value(self, value: Any) -> Optional[bytes]:
        """Encrypt the value before saving to database."""
        if value is None:
            return value

        # Get the current encryption method from options
        encryption_method = options.get('database.encryption.method')

        if encryption_method == 'fernet':
            return self._encrypt_fernet(value)
        elif encryption_method == 'keysets':
            # Future implementation
            raise NotImplementedError("Keysets encryption not yet implemented")
        else:
            # Default to plain text (stored as UTF-8 bytes)
            if isinstance(value, str):
                return value.encode('utf-8')
            elif isinstance(value, bytes):
                return value
            else:
                return str(value).encode('utf-8')

    def from_db_value(self, value: Optional[bytes], expression, connection) -> Optional[str]:
        """Decrypt the value when loading from database."""
        if value is None:
            return value

        # Try to decrypt with multiple methods as fallback
        return self._decrypt_with_fallback(value)

    def to_python(self, value: Any) -> Optional[str]:
        """Convert the value to Python type."""
        if value is None:
            return value

        # If it's already a string, return it
        if isinstance(value, str):
            return value

        # If it's bytes, try to decrypt
        if isinstance(value, bytes):
            return self._decrypt_with_fallback(value)

        return str(value)

    def _encrypt_fernet(self, value: str) -> bytes:
        """Encrypt using Fernet symmetric encryption."""
        key = self._get_fernet_key()
        if not key:
            logger.warning("No encryption key found, falling back to plain text")
            return value.encode('utf-8') if isinstance(value, str) else str(value).encode('utf-8')

        try:
            f = Fernet(key)
            if isinstance(value, str):
                value_bytes = value.encode('utf-8')
            else:
                value_bytes = str(value).encode('utf-8')

            encrypted = f.encrypt(value_bytes)
            # Prepend a marker byte to identify fernet encryption
            # 0x01 = fernet, 0x00 = plain text
            return b'\x01' + encrypted
        except Exception as e:
            logger.error(f"Failed to encrypt value: {e}")
            raise

    def _decrypt_with_fallback(self, value: bytes) -> str:
        """
        Attempt to decrypt with multiple methods.
        This handles cases where the encryption method was changed.
        """
        if not value:
            return ""

        # Check the first byte for encryption method marker
        if len(value) > 0:
            marker = value[0]

            if marker == 0x01:  # Fernet marker
                return self._decrypt_fernet(value[1:])
            elif marker == 0x02:  # Future: keysets marker
                raise NotImplementedError("Keysets decryption not yet implemented")

        # No marker or unknown marker, try current method then fallbacks
        current_method = options.get('database.encryption.method')

        if current_method == 'fernet':
            # Try fernet first (without marker for backwards compatibility)
            try:
                return self._decrypt_fernet(value)
            except Exception:
                # If fails, might be plain text
                try:
                    return value.decode('utf-8')
                except UnicodeDecodeError:
                    logger.error("Failed to decrypt value as fernet or decode as UTF-8")
                    # Return hex representation as last resort
                    return value.hex()

        # Default: assume plain text (UTF-8 encoded)
        try:
            return value.decode('utf-8')
        except UnicodeDecodeError:
            # If not valid UTF-8, return hex representation
            logger.warning("Value is not valid UTF-8, returning hex representation")
            return value.hex()

    def _decrypt_fernet(self, value: bytes) -> str:
        """Decrypt using Fernet."""
        key = self._get_fernet_key()
        if not key:
            logger.warning("No decryption key found")
            raise ValueError("Cannot decrypt without key")

        try:
            f = Fernet(key)
            decrypted = f.decrypt(value)
            return decrypted.decode('utf-8')
        except InvalidToken:
            # Could not decrypt, might be plain text or different key
            logger.debug("Failed to decrypt with Fernet, treating as plain text")
            try:
                return value.decode('utf-8')
            except UnicodeDecodeError:
                # Not valid UTF-8, return hex
                return value.hex()
        except Exception as e:
            logger.error(f"Failed to decrypt value: {e}")
            raise

    def _get_fernet_key(self) -> Optional[bytes]:
        """Get the Fernet key from Django settings."""
        key = getattr(settings, 'DATABASE_ENCRYPTION_FERNET_KEY', None)
        if key is None:
            return None

        if isinstance(key, str):
            # If key is a string, encode it
            key = key.encode('utf-8')

        # Validate key length (Fernet requires 32 bytes base64 encoded)
        try:
            Fernet(key)
            return key
        except Exception as e:
            logger.error(f"Invalid Fernet key: {e}")
            return None


class EncryptedCharField(EncryptedField):
    """An encrypted version of CharField."""

    def __init__(self, *args, **kwargs):
        # Extract max_length for validation purposes only
        self.model_max_length = kwargs.pop('max_length', 255)
        super().__init__(*args, **kwargs)

    def to_python(self, value: Any) -> Optional[str]:
        """Ensure we return a string and validate length."""
        result = super().to_python(value)
        if result is not None and len(result) > self.model_max_length:
            raise ValueError(f"Value exceeds max_length of {self.model_max_length}")
        return result


class EncryptedTextField(EncryptedField):
    """An encrypted version of TextField."""
    pass


class EncryptedEmailField(EncryptedField):
    """An encrypted version of EmailField."""

    def to_python(self, value: Any) -> Optional[str]:
        """Validate email format after decryption."""
        result = super().to_python(value)
        if result is not None:
            # Basic email validation
            if '@' not in result:
                raise ValueError(f"Invalid email address: {result}")
        return result
