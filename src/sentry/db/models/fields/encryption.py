import tink
from django.db import models
from tink import aead, cleartext_keyset_handle, tink_config

__all__ = ("EncryptedStringField",)


def init_tink():
    """Initialize Tink and register all AEAD key types."""
    try:
        tink_config.register()
    except Exception:
        pass


def _get_keyset_handle():
    """ """
    init_tink()  # TODO: this needs to be done once per process
    # keyset_path = settings.get("KEYSET_PATH", "/tmp/keyset.key")
    keyset_path = "/tmp/keyset.key"
    with open(keyset_path, "rb") as keyset_file:
        keyset_data = keyset_file.read()
        keyset_handle = cleartext_keyset_handle.read(tink.BinaryKeysetReader(keyset_data))
    return keyset_handle


def _encrypt_value(value: str) -> bytes:
    keyset_handle = _get_keyset_handle()
    aead_primitive = keyset_handle.primitive(aead.Aead)
    return aead_primitive.encrypt(value.encode("utf-8"), b"")


def _decrypt_value(value: bytes) -> str:
    keyset_handle = _get_keyset_handle()
    aead_primitive = keyset_handle.primitive(aead.Aead)
    return aead_primitive.decrypt(value, b"").decode("utf-8")


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
