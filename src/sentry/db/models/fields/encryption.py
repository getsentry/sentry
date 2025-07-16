from __future__ import annotations

import base64
import logging
from collections.abc import Callable
from typing import Any, Literal, TypedDict

import sentry_sdk
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db.models import Field

from sentry import options

logger = logging.getLogger(__name__)


# Encryption method markers
MARKER_PLAIN_TEXT = "00"
MARKER_FERNET = "01"
MARKER_TINK_KEYSETS = "02"  # Future implementation


class _EncryptionHandler(TypedDict):
    marker: str
    encrypt: Callable[[Any], str]
    decrypt: Callable[[bytes], str]


type _EncryptionMethod = Literal["plain_text"] | Literal["fernet"] | Literal["keysets"]


class EncryptedField(Field):
    """
    A mixin that adds encryption functionality to Django fields.

    Encryption method is controlled via the 'database.encryption.method' option.
    Supported methods:
    - 'plain_text': No encryption (default for development)
    - 'fernet': Fernet symmetric encryption
    - 'keysets': (Future) Google Tink keysets for key rotation

    Decryption will be done based on the marker, and not on the current active
    encryption method option. Current active encryption method option is only
    relevant when encrypting and storing the data.

    Uses base64 encoding for storing encrypted binary data as text.

    For Fernet encryption, the format is: {marker}:{key_id}:{encrypted_data}
    This allows for easier key rotation by storing which key was used for encryption.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self._encryption_handlers: dict[_EncryptionMethod, _EncryptionHandler] = {
            "plain_text": {
                "marker": MARKER_PLAIN_TEXT,
                "encrypt": self._encrypt_plain_text,
                "decrypt": self._decrypt_plain_text,
            },
            "fernet": {
                "marker": MARKER_FERNET,
                "encrypt": self._encrypt_fernet,
                "decrypt": self._decrypt_fernet,
            },
            "keysets": {
                "marker": MARKER_TINK_KEYSETS,
                "encrypt": self._encrypt_keysets,
                "decrypt": self._decrypt_keysets,
            },
        }

    def _format_encrypted_value(
        self, encrypted_data: bytes, marker: str, key_id: str | None = None
    ) -> str:
        """Format encrypted data with marker and optional key_id for storage.

        Args:
            encrypted_data: The raw encrypted bytes
            marker: The encryption method marker
            key_id: Optional key identifier for key rotation support

        Returns:
            Formatted string for database storage
        """
        encoded_data = base64.b64encode(encrypted_data).decode("ascii")
        if key_id is not None:
            return f"{marker}:{key_id}:{encoded_data}"
        else:
            return f"{marker}:{encoded_data}"

    def get_prep_value(self, value: Any) -> str | None:
        """Encrypt the value before saving to database."""
        value = super().get_prep_value(value)
        if value is None:
            return value

        encryption_method = options.get("database.encryption.method")

        # Default to plain_text if method is not recognized
        if encryption_method not in self._encryption_handlers:
            logger.error(
                "Unknown encryption method '%s', defaulting to plain_text", encryption_method
            )
            encryption_method = "plain_text"

        handler = self._encryption_handlers[encryption_method]
        return handler["encrypt"](value)

    def to_python(self, value: Any) -> str | None:
        """Decrypt the value when loading from database."""
        if value is None:
            return value

        # it's already a string and doesn't look encrypted, return it
        if isinstance(value, str) and not self._is_encrypted_format(value):
            return value

        # it's encrypted format, decrypt it
        if isinstance(value, str) and self._is_encrypted_format(value):
            return self._decrypt_with_fallback(value)

        # fallback
        return super().to_python(value)

    def _is_encrypted_format(self, value: str) -> bool:
        """Check if the value is in encrypted format (marker:base64data or marker:key_id:base64data)."""
        parts = value.split(":")
        return len(parts) >= 2 and len(parts[0]) == 2

    def _encrypt_plain_text(self, value: Any) -> str:
        """Store value as plain text (UTF-8 encoded)."""
        if isinstance(value, str):
            value_bytes = value.encode("utf-8")
        elif isinstance(value, bytes):
            value_bytes = value
        else:
            value_bytes = str(value).encode("utf-8")

        return self._format_encrypted_value(value_bytes, MARKER_PLAIN_TEXT)

    def _decrypt_plain_text(self, value: bytes) -> str:
        """Decrypt plain text (UTF-8 decode)."""
        try:
            return value.decode("utf-8")
        except UnicodeDecodeError:
            logger.warning("Value is not valid UTF-8, returning hex representation")
            return value.hex()

    def _encrypt_fernet(self, value: Any) -> str:
        """Encrypt using Fernet symmetric encryption.

        Returns formatted string with key_id for key rotation support.
        """
        key_id, key = self._get_fernet_key_for_encryption()
        if not key:
            raise ValueError(
                "Fernet encryption key is required but not found. "
                "Please set DATABASE_ENCRYPTION_FERNET_KEYS in your settings."
            )

        try:
            f = Fernet(key)
            if isinstance(value, str):
                value_bytes = value.encode("utf-8")
            else:
                value_bytes = str(value).encode("utf-8")

            encrypted_data = f.encrypt(value_bytes)
            return self._format_encrypted_value(encrypted_data, MARKER_FERNET, key_id)
        except Exception as e:
            # TODO: decide what to do with this error
            sentry_sdk.capture_exception(e)
            raise

    def _decrypt_fernet(self, value: bytes, key_id: str | None = None) -> str:
        """Decrypt using Fernet.

        Args:
            value: The encrypted data
            key_id: Optional key ID to use for decryption. If None, uses the first available key.
        """
        key = self._get_fernet_key(key_id)
        if not key:
            if key_id:
                logger.warning("No decryption key found for key_id '%s'", key_id)
            else:
                logger.warning("No decryption key found")
            raise ValueError("Cannot decrypt without key")

        try:
            f = Fernet(key)
            decrypted = f.decrypt(value)
            return decrypted.decode("utf-8")
        except InvalidToken:
            # Could not decrypt, treat as plain text
            logger.exception("Failed to decrypt with Fernet, treating as plain text")
            try:
                return value.decode("utf-8")
            except UnicodeDecodeError:
                # Not valid UTF-8, return hex
                return value.hex()
        except Exception as e:
            sentry_sdk.capture_exception(e)
            # TODO: add metrics
            logger.exception("Failed to decrypt value")
            raise

    def _encrypt_keysets(self, value: Any) -> str:
        """Encrypt using Google Tink keysets (future implementation)."""
        raise NotImplementedError("Keysets encryption not yet implemented")

    def _decrypt_keysets(self, value: bytes) -> str:
        """Decrypt using Google Tink keysets (future implementation)."""
        raise NotImplementedError("Keysets decryption not yet implemented")

    def _decrypt_with_fallback(self, value: str) -> str:
        """
        Attempt to decrypt with multiple methods.
        This handles cases where the encryption method was changed.
        """
        parts = value.split(":")
        if len(parts) < 2:
            return value

        marker = parts[0]

        # Handle new format with key_id for Fernet: marker:key_id:data
        if marker == MARKER_FERNET and len(parts) == 3:
            key_id, encoded_data = parts[1], parts[2]
            try:
                encrypted_data = base64.b64decode(encoded_data)
                return self._decrypt_fernet(encrypted_data, key_id)
            except Exception as e:
                sentry_sdk.capture_exception(e)
                logger.exception("Failed to decrypt with Fernet using key_id '%s'", key_id)

        # Handle legacy format: marker:data (for both Fernet and plain text)
        elif len(parts) == 2:
            encoded_data = parts[1]
            try:
                encrypted_data = base64.b64decode(encoded_data)
            except Exception:
                # If base64 decode fails, treat as plain text
                return value

            # Find handler by marker
            for method_name, handler in self._encryption_handlers.items():
                if handler["marker"] == marker:
                    try:
                        if method_name == "fernet":
                            # For legacy Fernet data without key_id
                            return self._decrypt_fernet(encrypted_data)
                        else:
                            return handler["decrypt"](encrypted_data)
                    except Exception as e:
                        sentry_sdk.capture_exception(e)
                        logger.exception("Failed to decrypt with %s", method_name)
                        continue

        return value

    def _get_fernet_key_for_encryption(self) -> tuple[str, bytes]:
        """Get the first Fernet key for encryption along with its key_id."""
        keys = getattr(settings, "DATABASE_ENCRYPTION_FERNET_KEYS", None)
        if keys is None:
            raise ValueError("DATABASE_ENCRYPTION_FERNET_KEYS is not configured")

        if not isinstance(keys, dict):
            logger.error("DATABASE_ENCRYPTION_FERNET_KEYS must be a dict, got %s", type(keys))
            raise ValueError("DATABASE_ENCRYPTION_FERNET_KEYS must be a dictionary")

        if not keys:
            raise ValueError("DATABASE_ENCRYPTION_FERNET_KEYS is empty")

        # Use the first key for encryption
        key_id = next(iter(keys.keys()))
        key = keys[key_id]

        if isinstance(key, str):
            key = key.encode("utf-8")

        # Validate key
        try:
            Fernet(key)
            return (key_id, key)
        except Exception as e:
            sentry_sdk.capture_exception(e)
            logger.exception("Invalid Fernet key for key_id '%s'", key_id)
            raise ValueError(f"Invalid Fernet key for key_id '{key_id}'")

    def _get_fernet_key(self, key_id: str | None = None) -> bytes | None:
        """Get the Fernet key from Django settings."""
        keys = getattr(settings, "DATABASE_ENCRYPTION_FERNET_KEYS", None)
        if keys is None:
            return None

        if not isinstance(keys, dict):
            logger.error("DATABASE_ENCRYPTION_FERNET_KEYS must be a dict, got %s", type(keys))
            return None

        if key_id is None:
            # Return first/default key if no key_id specified
            if not keys:
                return None
            key = next(iter(keys.values()))
        else:
            # Return specific key by key_id
            if key_id not in keys:
                logger.warning("Fernet key with id '%s' not found, cannot decrypt data", key_id)
                return None
            key = keys[key_id]

        if isinstance(key, str):
            # If key is a string, encode it
            key = key.encode("utf-8")

        # Validate key length (Fernet requires 32 bytes base64 encoded)
        try:
            Fernet(key)
            return key
        except Exception as e:
            sentry_sdk.capture_exception(e)
            logger.exception("Invalid Fernet key")

        return None
