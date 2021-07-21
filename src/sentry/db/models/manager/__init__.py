from typing import Any, Mapping, Union

from django.db.models import Model
from django.utils.encoding import smart_text

from sentry.utils.hashlib import md5_text

__all__ = ("BaseManager", "OptionManager")


def __prep_value(model: Any, key: str, value: Union[Model, int, str]) -> str:
    if isinstance(value, Model):
        return value.pk
    else:
        value = str(value)
    return value


def __prep_key(model: Any, key: str) -> str:
    if key == "pk":
        return model._meta.pk.name
    return key


def make_key(model: Any, prefix: str, kwargs: Mapping[str, Union[Model, int, str]]):
    kwargs_bits = []
    for k, v in sorted(kwargs.items()):
        k = __prep_key(model, k)
        v = smart_text(__prep_value(model, k, v))
        kwargs_bits.append(f"{k}={v}")
    kwargs_bits = ":".join(kwargs_bits)

    return f"{prefix}:{model.__name__}:{md5_text(kwargs_bits).hexdigest()}"


# Exporting these classes at the bottom to avoid circular dependencies.
from .base import BaseManager
from .option import OptionManager
