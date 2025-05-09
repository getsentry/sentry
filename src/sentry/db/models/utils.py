from __future__ import annotations

from collections.abc import Container
from typing import TYPE_CHECKING, Any, Generic, Self, overload
from uuid import uuid4

from django.db.models import Field, Model
from django.utils.crypto import get_random_string
from django.utils.text import slugify

from sentry.db.models.fields.types import FieldGetType, FieldSetType

if TYPE_CHECKING:
    from sentry.db.models.base import Model as SentryModel


def unique_db_instance(
    inst: SentryModel,
    base_value: str,
    reserved: Container[str] = (),
    max_length: int = 30,
    field_name: str = "slug",
    *args: Any,
    **kwargs: Any,
) -> None:
    if base_value is not None:
        base_value = base_value.strip()
        if base_value in reserved:
            base_value = ""

    if not base_value:
        base_value = uuid4().hex[:12]

    base_qs = type(inst).objects.all()
    if inst.id:
        base_qs = base_qs.exclude(id=inst.id)
    if args or kwargs:
        base_qs = base_qs.filter(*args, **kwargs)

    setattr(inst, field_name, base_value)

    # Don't further mutate if the value is unique and not entirely numeric
    if (
        not base_qs.filter(**{f"{field_name}__iexact": base_value}).exists()
        and not base_value.isdecimal()
    ):
        return

    # We want to sanely generate the shortest unique slug possible, so
    # we try different length endings until we get one that works, or bail.

    # At most, we have 27 attempts here to derive a unique slug
    sizes = (
        (1, 2),  # (36^2) possibilities, 2 attempts
        (5, 3),  # (36^3) possibilities, 3 attempts
        (20, 5),  # (36^5) possibilities, 20 attempts
        (1, 12),  # (36^12) possibilities, 1 final attempt
    )
    for attempts, size in sizes:
        for i in range(attempts):
            end = get_random_string(size, allowed_chars="abcdefghijklmnopqrstuvwxyz0123456790")
            value = base_value[: max_length - size - 1] + "-" + end
            setattr(inst, field_name, value)
            if not base_qs.filter(**{f"{field_name}__iexact": value}).exists():
                return

    # If at this point, we've exhausted all possibilities, we'll just end up hitting
    # an IntegrityError from database, which is ok, and unlikely to happen


def slugify_instance(
    inst: SentryModel,
    label: str,
    reserved: Container[str] = (),
    max_length: int = 30,
    field_name: str = "slug",
    *args: Any,
    **kwargs: Any,
) -> None:
    value = slugify(label)[:max_length]
    value = value.strip("-")

    return unique_db_instance(inst, value, reserved, max_length, field_name, *args, **kwargs)


class Creator(Generic[FieldSetType, FieldGetType]):
    """
    A descriptor that invokes `to_python` when attributes are set.
    This provides backwards compatibility for fields that used to use
    SubfieldBase which will be removed in Django1.10
    """

    def __init__(self, field: Field[FieldSetType, FieldGetType]) -> None:
        self.field = field

    @overload
    def __get__(self, inst: Model, owner: type[Any]) -> Any: ...

    @overload
    def __get__(self, inst: None, owner: type[Any]) -> Self: ...

    def __get__(self, inst: Model | None, owner: type[Any]) -> Self | Any:
        if inst is None:
            return self
        return inst.__dict__[self.field.name]

    def __set__(self, obj: Model, value: Any) -> None:
        obj.__dict__[self.field.name] = self.field.to_python(value)


import enum
import io
import typing
import uuid
from dataclasses import dataclass

from cryptography.fernet import Fernet


class KeyStatus(enum.IntEnum):
    DISABLED = 0
    ACTIVE = 1


STATUS_BINARY_SIZE = 1  # 1 byte used to represent status
KEY_ID_LENGTH = 16  # 16 bytes == 128 bits == uuid4
KEY_LENGTH = 44  # 44 bytes -  URL-safe base64 encoded fernet key


@dataclass
class Key:
    status: KeyStatus
    key_id: bytes
    key: bytes


class KeysetHandler:
    def __init__(self):
        self._keyset: dict[bytes, Key] = {}

    def load(self, io_stream: typing.BinaryIO) -> None:
        """
        TODO: include file version in the stream - for future compatibility
        Load keyset from io stream.
        Keys are loaded in the following format, from the beginning of the stream:
        - status (1 byte)
        - key_id (16 bytes)
        - key (44 bytes)
        --------------------------------
        | status | key_id   | key       |
        --------------------------------
        | 1 byte | 16 bytes | 44 bytes  |
        --------------------------------
        """
        while True:
            status_as_bytes = io_stream.read(STATUS_BINARY_SIZE)
            if not status_as_bytes:  # EOF: read returned empty bytes
                break

            if len(status_as_bytes) < STATUS_BINARY_SIZE:
                raise ValueError("Malformed keyset file: incomplete status read.")

            status = KeyStatus(int.from_bytes(status_as_bytes, "big"))

            key_id = io_stream.read(KEY_ID_LENGTH)
            if len(key_id) < KEY_ID_LENGTH:
                raise ValueError("Malformed keyset file: incomplete key_id read.")

            key_value = io_stream.read(KEY_LENGTH)  # Renamed variable for clarity
            if len(key_value) < KEY_LENGTH:
                raise ValueError("Malformed keyset file: incomplete key read.")

            self.add_key(Key(status, key_id, key_value))

    def save(self, io_stream: io.BytesIO) -> None:
        """
        Save keyset to io stream.
        Keys are saved in the following format:
        - status (1 byte)
        - key_id (16 bytes)
        - key (44 bytes)
        """
        for key in self._keyset.values():
            io_stream.write(key.status.value.to_bytes(STATUS_BINARY_SIZE, "big"))
            io_stream.write(key.key_id)
            io_stream.write(key.key)

    def add_key(self, key: Key) -> None:
        """
        Add key to keyset
        """
        self._keyset[key.key_id] = key

    def _delete_key(self, key_id: str) -> None:
        """
        Caution: This method will delete key from keyset.
        This operation is irreversible.

        If you only want to disable key, use disable_key method instead.
        """
        del self._keyset[key_id]

    def get_key(self, key_id: bytes) -> Key:
        """
        Get key from keyset
        """
        if key_id not in self._keyset:
            raise ValueError(f"Key {key_id} not found")

        return self._keyset[key_id]

    @staticmethod
    def generate_key() -> Key:
        """
        Generate key
        """
        key_id = uuid.uuid4().bytes
        fernet_key = Fernet.generate_key()
        return Key(key_id=key_id, key=fernet_key, status=KeyStatus.ACTIVE)

    def promote_key(self, key_id: bytes) -> None:
        """
        Promote key to active. Primary key is the first key in the keyset.
        """
        if key_id not in self._keyset:
            raise ValueError(f"Key {key_id} not found")

        key_to_promote = self.get_key(key_id)
        if key_to_promote.status != KeyStatus.ACTIVE:
            raise ValueError(f"Key {key_id} is not active")

        # update keyset by making key_to_promote the first key in the dict
        updated_keyset = {key_id: key_to_promote}
        updated_keyset.update(self._keyset)
        self._keyset = updated_keyset

    def encrypt(self, data: bytes) -> bytes:
        """
        Encrypt data
        """
        primary_key = self._get_primary_key()
        if primary_key is None:
            raise ValueError("No active key found")

        fernet = Fernet(primary_key.key)
        return primary_key.key_id + fernet.encrypt(data)  # format: key_id + encrypted_data

    def decrypt(self, data: bytes) -> bytes:
        """
        Decrypt data
        """
        key_id, data = data[:KEY_ID_LENGTH], data[KEY_ID_LENGTH:]
        key = self.get_key(key_id)
        if key.status != KeyStatus.ACTIVE:
            raise ValueError(f"Key {key_id} is not active")

        fernet = Fernet(key.key)
        return fernet.decrypt(data)

    def activate_key(self, key_id: bytes) -> None:
        """
        Activate key
        """
        if key_id not in self._keyset:
            raise ValueError(f"Key {key_id} not found")

        self._change_key_status(key_id, KeyStatus.ACTIVE)

    def disable_key(self, key_id: bytes) -> None:
        """
        Disable key
        """
        self._change_key_status(key_id, KeyStatus.DISABLED)

    def _get_primary_key(self) -> Key | None:
        """
        First active key in a keyset is considered as the primary key
        """
        for key in self._keyset.values():
            if key.status == KeyStatus.ACTIVE:
                return key
        return None

    def _change_key_status(self, key_id: bytes, status: KeyStatus) -> None:
        """
        Change key status
        """
        if key_id not in self._keyset:
            raise ValueError(f"Key {key_id} not found")

        self._keyset[key_id].status = status
