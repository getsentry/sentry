from __future__ import annotations

from datetime import UTC, datetime
from enum import Enum
from typing import Generic, NamedTuple, TypeVar

from django.core.serializers.json import DjangoJSONEncoder
from django.db import models

# Django apps we take care to never import or export from.
EXCLUDED_APPS = frozenset(("auth", "contenttypes", "fixtures"))


class Printer:
    """
    A simplified interface for a terminal CLI input-output interface. The default implementation is
    a no-op.
    """

    def echo(
        self,
        text: str,
        *,
        err: bool = False,
        color: bool | None = None,
    ) -> None:
        pass

    def confirm(
        self,
        text: str,
        *,
        default: bool | None = None,
        err: bool = False,
    ) -> bool:
        return True


class DatetimeSafeDjangoJSONEncoder(DjangoJSONEncoder):
    """
    A wrapper around the default `DjangoJSONEncoder` that always retains milliseconds, even when
    their implicit value is `.000`. This is necessary because the ECMA-262 compatible
    `DjangoJSONEncoder` drops these by default.
    """

    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        return super().default(obj)


class Side(Enum):
    """
    Used to identify the "side" in backup operations which perform comparisons between two sets of exports JSONs. The "left" side is usually the older of the two states (ie, "left" is roughly synonymous with "before", and "right" with "after").
    """

    left = 1
    right = 2


T = TypeVar("T")


class Filter(Generic[T]):
    """Specifies a field-based filter when performing an import or export operation. This is an
    allowlist based filtration: models of the given type whose specified field matches ANY of the
    supplied values will be allowed through."""

    model: type[models.base.Model]
    field: str
    values: set[T]

    def __init__(self, model: type[models.base.Model], field: str, values: set[T] | None = None):
        self.model = model
        self.field = field
        self.values = values if values is not None else set()


class ImportFlags(NamedTuple):
    """
    Flags that affect how importing a relocation JSON file proceeds.
    """

    # If a username already exists, should we re-use that user, or create a new one with a randomly
    # suffixed username (ex: "some-user" would become "some-user-ad21")
    merge_users: bool = False

    # If a global configuration value `ControlOption`/`Option` (as identified by its unique
    # `key`) or `Relay` (as identified by its unique `relay_id`) already exists, should we overwrite
    # it with the new value, or keep the existing one and discard the incoming value instead?
    overwrite_configs: bool = False

    # A UUID with which to identify this import's `*ImportChunk` database entries. Useful for
    # passing the calling `Relocation` model's UUID to all of the imports it triggered. If this flag
    # is not provided, the import was called in a non-relocation context, like from the `sentry
    # import` CLI command.
    import_uuid: str | None = None
