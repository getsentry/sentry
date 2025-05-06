import pickle

from cryptography.fernet import MultiFernet
from django.db import models

__all__ = ("EncryptedStringField",)


def _get_fernet_object() -> MultiFernet:
    keys_path = "/tmp/multi_fernet.bin"
    with open(keys_path, "rb") as f:
        unpickled_fernet = pickle.load(f)
    # test if it works
    # unpickled_fernet = MultiFernet([Fernet(Fernet.generate_key()) for _ in range(3)])
    return unpickled_fernet


def _encrypt_value(value: str) -> bytes:
    fernet = _get_fernet_object()
    return fernet.encrypt(value.encode("utf-8"))


def _decrypt_value(value: bytes) -> str:
    fernet = _get_fernet_object()
    return fernet.decrypt(value).decode("utf-8")


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
