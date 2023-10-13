from __future__ import annotations

from datetime import datetime, timedelta, timezone
from enum import Enum
from functools import lru_cache
from typing import Generic, NamedTuple, Type, TypeVar

from django.core.serializers.json import DjangoJSONEncoder
from django.db import models

from sentry.backup.scopes import RelocationScope

# Django apps we take care to never import or export from.
EXCLUDED_APPS = frozenset(("auth", "contenttypes", "fixtures"))

UTC_0 = timezone(timedelta(hours=0))


class DatetimeSafeDjangoJSONEncoder(DjangoJSONEncoder):
    """A wrapper around the default `DjangoJSONEncoder` that always retains milliseconds, even when
    their implicit value is `.000`. This is necessary because the ECMA-262 compatible
    `DjangoJSONEncoder` drops these by default."""

    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.astimezone(UTC_0).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        return super().default(obj)


def get_final_derivations_of(model: Type) -> set[Type]:
    """A "final" derivation of the given `model` base class is any non-abstract class for the
    "sentry" app with `BaseModel` as an ancestor. Top-level calls to this class should pass in
    `BaseModel` as the argument."""

    out = set()
    for sub in model.__subclasses__():
        subs = sub.__subclasses__()
        if subs:
            out.update(get_final_derivations_of(sub))
        if not sub._meta.abstract and sub._meta.db_table and sub._meta.app_label == "sentry":
            out.add(sub)
    return out


# No arguments, so we lazily cache the result after the first calculation.
@lru_cache(maxsize=1)
def get_exportable_sentry_models() -> set[Type]:
    """Like `get_final_derivations_of`, except that it further filters the results to include only
    `__relocation_scope__ != RelocationScope.Excluded`."""

    from sentry.db.models import BaseModel

    return set(
        filter(
            lambda c: getattr(c, "__relocation_scope__") is not RelocationScope.Excluded,
            get_final_derivations_of(BaseModel),
        )
    )


class Side(Enum):
    left = 1
    right = 2


T = TypeVar("T")


class Filter(Generic[T]):
    """Specifies a field-based filter when performing an import or export operation. This is an
    allowlist based filtration: models of the given type whose specified field matches ANY of the
    supplied values will be allowed through."""

    model: Type[models.base.Model]
    field: str
    values: set[T]

    def __init__(self, model: Type[models.base.Model], field: str, values: set[T] | None = None):
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
