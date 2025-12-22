import logging
from typing import Any

import sentry_sdk
from django.db.models import JSONField

from sentry.utils import json

from ._base import EncryptedField

logger = logging.getLogger(__name__)


class EncryptedJSONField(EncryptedField, JSONField):
    """
    An encrypted field that stores JSON data.

    This field is a drop-in replacement for JSONField that adds encryption.
    Data is stored as jsonb in the database with the encrypted payload wrapped
    in a structure: {"sentry_encrypted_field_value": "enc:method:key_id:data"}

    This allows for:
    - Reuse of EncryptedField's encryption logic via composition
    - Fallback to unencrypted JSON for backward compatibility
    - Easy identification of encrypted vs unencrypted data
    - True jsonb storage for database compatibility

    The field handles:
    - Encryption: Python object → JSON → encrypt → wrap in JSON object → store as jsonb
    - Decryption: load jsonb → check for wrapper → decrypt → parse JSON → Python object
    - Fallback: If no wrapper present, return parsed JSON as-is
    """

    _encrypted_field_key = "sentry_encrypted_field_value"

    @sentry_sdk.trace
    def get_prep_value(self, value: Any) -> dict | None:
        """
        Prepare value for database storage.

        Flow: Python object → JSON string → encrypt → wrap in dict → return
        """
        if value is None:
            return None

        # First, serialize the Python object to JSON string
        json_string = json.dumps(value)

        # Encrypt the JSON string using the EncryptedField
        # This will return something like "enc:fernet:key_id:base64data"
        encrypted_value = super().get_prep_value(json_string)

        if encrypted_value is None:
            return None

        # Wrap the encrypted string in a dict for jsonb storage
        # This will be stored as jsonb, not as a string
        return {self._encrypted_field_key: encrypted_value}

    @sentry_sdk.trace
    def to_python(self, value: Any) -> Any:
        """
        Convert database value to Python object.

        Flow:
        1. Value from database (already parsed as dict if jsonb)
        2. Check for encrypted wrapper structure
        3. If encrypted: decrypt → parse JSON → return Python object
        4. If not encrypted (fallback): return value as-is
        """
        if value is None:
            return value

        # If value is a string, it might be from form input or serialization
        # Parse it first
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except (ValueError, TypeError):
                # If it can't be parsed, return as-is
                return value

        # If it's not a dict at this point, return as-is
        if not isinstance(value, dict):
            return value

        # Check if this is our encrypted wrapper structure
        if self._encrypted_field_key in value and len(value) == 1:
            # Extract the encrypted value and decrypt it
            encrypted_value = value[self._encrypted_field_key]
            decrypted_bytes = super().to_python(encrypted_value)

            # Convert bytes to string if needed
            if isinstance(decrypted_bytes, bytes):
                decrypted_string = decrypted_bytes.decode("utf-8")
            else:
                decrypted_string = decrypted_bytes

            # Parse the decrypted JSON string back to Python object
            try:
                return json.loads(decrypted_string)
            except (ValueError, TypeError) as e:
                logger.warning("Failed to parse decrypted JSON: %s", e)
                # Fallback: return the original value
                return value

        # Fallback: No encrypted wrapper found, return the value as-is
        # This handles backward compatibility with unencrypted data
        return value
