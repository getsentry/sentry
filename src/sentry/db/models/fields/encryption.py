from cryptography.fernet import Fernet
from django.conf import settings
from django.db import models

__all__ = ("EncryptedStringField",)


def _get_encryption_key() -> bytes:
    """
    Returns a Fernet-compatible 32 byte url-safe base64-encoded key.
    The input key from settings must be a 32-byte url-safe base64-encoded string.
    """
    key = settings.SENTRY_DB_ENCRYPTION_KEY
    if isinstance(key, str):
        # If the key is a string, encode it to bytes, as Fernet expects bytes
        return key.encode("utf-8")

    return key


def _encrypt_value(value: str) -> bytes:
    encryption_key = _get_encryption_key()
    return Fernet(encryption_key).encrypt(value.encode("utf-8"))


def _decrypt_value(value: bytes) -> str:
    decryption_key = _get_encryption_key()
    return Fernet(decryption_key).decrypt(value).decode("utf-8")


class EncryptedStringField(models.BinaryField):
    def get_prep_value(self, value):
        if value is None:
            return None

        return _encrypt_value(value)

    def from_db_value(self, value, *args, **kwargs):
        return self.to_python(value)

    def to_python(self, value):
        if value is None:
            return None

        if isinstance(value, bytes):
            return _decrypt_value(value)

        value = bytes(value)
        return _decrypt_value(value)
