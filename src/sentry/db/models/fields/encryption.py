from functools import lru_cache

from django.db import models

from sentry.db.models.utils import KeysetHandler

__all__ = ("EncryptedStringField",)


@lru_cache(maxsize=1)
def _get_keyset_handler() -> KeysetHandler:
    keys_path = "/tmp/keyset.bin"
    keyset_handler = KeysetHandler()
    with open(keys_path, "rb") as f:
        keyset_handler.load(f)

    return keyset_handler


def _encrypt_value(value: str) -> bytes:
    keyset_handler = _get_keyset_handler()
    return keyset_handler.encrypt(value.encode("utf-8"))


def _decrypt_value(value: bytes) -> str:
    keyset_handler = _get_keyset_handler()
    return keyset_handler.decrypt(value).decode("utf-8")


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
