from typing import Any, Callable, Mapping, TypeVar, Union

from django.db.models import Model
from django.utils.encoding import smart_text

from sentry.utils.hashlib import md5_text

__all__ = ("BaseManager", "BaseQuerySet", "OptionManager", "Value", "ValidateFunction")

M = TypeVar("M", bound=Model)
Value = Any
ValidateFunction = Callable[[Value], bool]


def __prep_value(model: Any, key: str, value: Union[Model, int, str]) -> str:
    val = value
    if isinstance(value, Model):
        val = value.pk
    return str(val)


def __prep_key(model: Any, key: str) -> str:
    if key == "pk":
        return str(model._meta.pk.name)
    return key


def make_key(model: Any, prefix: str, kwargs: Mapping[str, Union[Model, int, str]]) -> str:
    kwargs_bits = []
    for k, v in sorted(kwargs.items()):
        k = __prep_key(model, k)
        v = smart_text(__prep_value(model, k, v))
        kwargs_bits.append(f"{k}={v}")
    kwargs_bits_str = ":".join(kwargs_bits)

    return f"{prefix}:{model.__name__}:{md5_text(kwargs_bits_str).hexdigest()}"


# Exporting these classes at the bottom to avoid circular dependencies.
from .base import BaseManager
from .base_query_set import BaseQuerySet
from .option import OptionManager
