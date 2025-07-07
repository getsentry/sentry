from __future__ import annotations

import base64
import logging
from typing import Any, Optional

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import models
from django.db.models import Field

from sentry import options

logger = logging.getLogger(__name__)


class EncryptedField(Field):
    """
    A field that supports multiple encryption methods.

    Encryption method is controlled via the 'database.encryption.method' option.
    Supported methods:
    - 'plain_text': No encryption (default for development)
    - 'fernet': Fernet symmetric encryption
    - 'keysets': (Future) Google Tink keysets for key rotation

    When decrypting, the field will attempt multiple methods as fallback
    to handle cases where the encryption method was changed.
    """

    empty_strings_allowed = False

    def __init__(self, *args, **kwargs):
        # Remove any custom kwargs before passing to parent
        self.max_length = kwargs.pop('max_length', None)
        super().__init__(*args, **kwargs)

    def get_internal_type(self):
        return "TextField"

    def get_prep_value(self, value: Any) -> Optional[str]:
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
            # Default to plain text
            return str(value)

    def from_db_value(self, value: Optional[str], expression, connection) -> Optional[str]:
        """Decrypt the value when loading from database."""
        if value is None:
            return value

        # Try to decrypt with multiple methods as fallback
        return self._decrypt_with_fallback(value)

    def to_python(self, value: Any) -> Optional[str]:
        """Convert the value to Python type."""
        if value is None or isinstance(value, str):
            return value
        return str(value)

    def _encrypt_fernet(self, value: str) -> str:
        """Encrypt using Fernet symmetric encryption."""
        key = self._get_fernet_key()
        if not key:
            logger.warning("No encryption key found, falling back to plain text")
            return value

        try:
            f = Fernet(key)
            encrypted = f.encrypt(value.encode('utf-8'))
            # Prefix with method identifier for future decryption
            return f"fernet:{base64.urlsafe_b64encode(encrypted).decode('utf-8')}"
        except Exception as e:
            logger.error(f"Failed to encrypt value: {e}")
            raise

    def _decrypt_with_fallback(self, value: str) -> str:
        """
        Attempt to decrypt with multiple methods.
        This handles cases where the encryption method was changed.
        """
        # Check if value has a method prefix
        if ':' in value and value.index(':') < 20:  # Reasonable prefix length
            method, encrypted_value = value.split(':', 1)

            if method == 'fernet':
                return self._decrypt_fernet(encrypted_value)
            elif method == 'keysets':
                # Future implementation
                raise NotImplementedError("Keysets decryption not yet implemented")

        # No prefix found, try current method then fallbacks
        current_method = options.get('database.encryption.method')

        if current_method == 'fernet':
            # Try fernet first
            try:
                return self._decrypt_fernet(value)
            except Exception:
                # If fails, might be plain text
                return value

        # Default: assume plain text
        return value

    def _decrypt_fernet(self, value: str) -> str:
        """Decrypt using Fernet."""
        key = self._get_fernet_key()
        if not key:
            logger.warning("No decryption key found")
            raise ValueError("Cannot decrypt without key")

        try:
            f = Fernet(key)
            # Handle both base64 encoded and raw encrypted values
            try:
                encrypted = base64.urlsafe_b64decode(value.encode('utf-8'))
            except Exception:
                encrypted = value.encode('utf-8')

            decrypted = f.decrypt(encrypted)
            return decrypted.decode('utf-8')
        except InvalidToken:
            # Could not decrypt, might be plain text or different key
            logger.debug("Failed to decrypt with Fernet, treating as plain text")
            return value
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


class EncryptedCharField(EncryptedField, models.CharField):
    """An encrypted version of CharField."""

    def __init__(self, *args, **kwargs):
        # Extract max_length before passing to parent
        self.model_max_length = kwargs.get('max_length', 255)
        super().__init__(*args, **kwargs)

    def get_internal_type(self):
        # Use TextField because encrypted values can be longer than original
        return "TextField"


class EncryptedTextField(EncryptedField, models.TextField):
    """An encrypted version of TextField."""
    pass


class EncryptedEmailField(EncryptedField, models.EmailField):
    """An encrypted version of EmailField."""

    def get_internal_type(self):
        # Use TextField because encrypted values can be longer
        return "TextField"
