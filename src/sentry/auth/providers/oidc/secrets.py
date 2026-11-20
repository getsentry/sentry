from __future__ import annotations

from sentry.db.models.fields.encryption import EncryptedTextField

# AuthProvider.config is a plain JSONField, so the client secret is encrypted on its own
# with the same scheme as the encrypted model fields (`database.encryption.method`).
_field = EncryptedTextField()


def encrypt_client_secret(secret: str) -> str:
    value = _field.get_prep_value(secret)
    assert isinstance(value, str)
    return value


def decrypt_client_secret(value: str) -> str:
    decrypted = _field.to_python(value)
    if isinstance(decrypted, bytes):
        return decrypted.decode("utf-8")
    assert isinstance(decrypted, str)
    return decrypted
