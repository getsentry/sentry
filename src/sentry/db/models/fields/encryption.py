from __future__ import annotations

import base64
import logging
from collections.abc import Callable
from typing import Any, Literal, TypedDict

import sentry_sdk
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db.models import CharField, Field

from sentry import options

logger = logging.getLogger(__name__)


# Encryption method markers
MARKER_PLAINTEXT = "enc:plaintext"
MARKER_FERNET = "enc:fernet"
MARKER_TINK_KEYSETS = "enc:tink"  # Future implementation

KNOWN_MARKERS = {MARKER_PLAINTEXT, MARKER_FERNET, MARKER_TINK_KEYSETS}


class _EncryptionHandler(TypedDict):
    marker: str
    encrypt: Callable[[Any], str]
    decrypt: Callable[[str], bytes]


type _EncryptionMethod = Literal["plaintext"] | Literal["fernet"] | Literal["keysets"]


class EncryptedField(Field):
    """
    A mixin that adds encryption functionality to Django fields.

    Encryption method is controlled via the 'database.encryption.method' option.
    Supported methods:
    - 'plaintext': No encryption (default for development)
    - 'fernet': Fernet symmetric encryption
    - 'keysets': (Future) Google Tink keysets for key rotation

    Decryption will be done based on the marker, and not on the current active
    encryption method option. Current active encryption method option is only
    relevant when encrypting and storing the data.

    Uses base64 encoding for storing encrypted binary data as text.

    Formats:
    - Plaintext: enc:plaintext:{base64_data}
    - Fernet: enc:fernet:{key_id}:{base64_encrypted_data}
    - Tink: enc:tink:{base64_data} (future)

    The Fernet format always includes a key_id to support key rotation.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self._encryption_handlers: dict[_EncryptionMethod, _EncryptionHandler] = {
            "plaintext": {
                "marker": MARKER_PLAINTEXT,
                "encrypt": self._encrypt_plaintext,
                "decrypt": self._decrypt_plaintext,
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

        # Default to plaintext if method is not recognized
        if encryption_method not in self._encryption_handlers:
            logger.error(
                "Unknown encryption method '%s', defaulting to plaintext", encryption_method
            )
            encryption_method = "plaintext"

        handler = self._encryption_handlers[encryption_method]
        return handler["encrypt"](value)

    def from_db_value(self, value: Any, expression: Any, connection: Any) -> bytes | str | None:
        return self.to_python(value)

    def to_python(self, value: Any) -> Any:
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
        """Check if the value is in encrypted format.

        Expected formats:
        - enc:plaintext:base64data
        - enc:fernet:key_id:base64data
        - enc:tink:base64data
        """
        # Check if value starts with any known marker
        for marker in KNOWN_MARKERS:
            if value.startswith(marker + ":"):
                return True
        return False

    def _get_value_in_bytes(self, value: Any) -> bytes:
        if isinstance(value, str):
            return value.encode("utf-8")
        elif isinstance(value, bytes):
            return value
        else:
            return str(value).encode("utf-8")

    def _encrypt_plaintext(self, value: Any) -> str:
        """Store value as plain text (UTF-8 encoded)."""
        value_bytes = self._get_value_in_bytes(value)
        return self._format_encrypted_value(value_bytes, MARKER_PLAINTEXT)

    def _decrypt_plaintext(self, value: str) -> bytes:
        """Decrypt plain text. Extracts data from the formatted value.

        Expected format: enc:plaintext:base64data
        """
        # Decode base64
        try:
            data = base64.b64decode(value)
            return data
        except Exception as e:
            logger.warning("Failed to decode base64 data: %s", e)
            raise ValueError("Invalid base64 encoding") from e

    def _encrypt_fernet(self, value: Any) -> str:
        """Encrypt using Fernet symmetric encryption.

        Always returns formatted string: enc:fernet:key_id:base64data
        The key_id is required to support key rotation.
        """
        key_id, key = self._get_fernet_key_for_encryption()
        if not key:
            raise ValueError(
                "Fernet encryption key is required but not found. "
                "Please set DATABASE_ENCRYPTION_FERNET_KEYS in your settings."
            )

        try:
            f = Fernet(key)
            value_bytes = self._get_value_in_bytes(value)
            encrypted_data = f.encrypt(value_bytes)
            return self._format_encrypted_value(encrypted_data, MARKER_FERNET, key_id)
        except Exception as e:
            sentry_sdk.capture_exception(e)
            raise

    def _decrypt_fernet(self, value: str) -> bytes:
        """Decrypt using Fernet. Extracts key_id from the formatted value.

        Expected format: enc:fernet:key_id:base64data
        """
        # Parse key_id and data
        parts = value.split(":", 1)
        if len(parts) != 2:
            logger.warning("Invalid Fernet format, expected key_id:data")
            raise ValueError("Invalid Fernet format, expected key_id:data")

        key_id, encoded_data = parts[0], parts[1]

        # Decode base64
        try:
            encrypted_data = base64.b64decode(encoded_data)
        except Exception as e:
            logger.warning("Failed to decode base64 data: %s", e)
            raise ValueError("Invalid base64 encoding") from e

        # Get the decryption key
        key = self._get_fernet_key(key_id)
        if not key:
            logger.warning("No decryption key found for key_id '%s'", key_id)
            raise ValueError(f"Cannot decrypt without key for key_id '{key_id}'")

        try:
            f = Fernet(key)
            decrypted = f.decrypt(encrypted_data)
            return decrypted
        except InvalidToken:  # noqa
            # Decryption failed—this may occur if the value is actually plain text that happens to match
            # the Fernet-encrypted format (e.g., during a migration or data corruption). We intentionally
            # let the caller handle this error so that fallback logic (such as returning the original value)
            # can be applied at a higher level.
            raise

    def _encrypt_keysets(self, value: Any) -> str:
        """Encrypt using Google Tink keysets (future implementation)."""
        raise NotImplementedError("Keysets encryption not yet implemented")

    def _decrypt_keysets(self, value: str) -> bytes:
        """Decrypt using Google Tink keysets (future implementation).

        Expected format: enc:tink:base64data
        """
        raise NotImplementedError("Keysets decryption not yet implemented")

    def _decrypt_with_fallback(self, value: str) -> bytes | str:
        """
        Attempt to decrypt with the appropriate method based on the marker.
        Returns the original value if decryption fails.
        """
        # Check if it starts with a known marker
        marker = None
        for known_marker in KNOWN_MARKERS:
            if value.startswith(known_marker + ":"):
                marker = known_marker
                # Remove the marker and colon
                remaining = value[len(marker) + 1 :]
                break

        if not marker:
            # No known marker found, return as-is
            return value

        # Find the appropriate handler by marker
        for method_name, handler in self._encryption_handlers.items():
            if handler["marker"] == marker:
                try:
                    # Pass the full formatted value to the decrypt method
                    return handler["decrypt"](remaining)
                except InvalidToken:
                    # Data might be plain text that happens to accidentally match the encrypted format
                    # Treating this as plain text is the best fallback.
                    return value
                except Exception as e:
                    sentry_sdk.capture_exception(e)
                    logger.exception("Failed to decrypt with %s", method_name)
                    return value

        # No handler found for this marker (shouldn't happen with known markers)
        logger.warning("No handler found for marker '%s'", marker)
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

        if not key_id or not key:
            raise ValueError(
                f"DATABASE_ENCRYPTION_FERNET_KEYS has invalid key_id or key ({key_id}, {key})"
            )

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

    def _get_fernet_key(self, key_id: str) -> bytes | None:
        """Get the Fernet key for the specified key_id from Django settings."""
        keys = getattr(settings, "DATABASE_ENCRYPTION_FERNET_KEYS", None)
        if keys is None:
            return None

        if not isinstance(keys, dict):
            logger.error("DATABASE_ENCRYPTION_FERNET_KEYS must be a dict, got %s", type(keys))
            return None

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


class EncryptedCharField(EncryptedField, CharField):
    def from_db_value(self, value: Any, expression: Any, connection: Any) -> Any:
        db_value = super().from_db_value(value, expression, connection)
        if db_value is None:
            return db_value
        if isinstance(db_value, bytes):
            db_value = db_value.decode("utf-8")
        return db_value
