# Avoid shadowing the standard library json module

from __future__ import annotations

import datetime
import decimal
import uuid
from collections.abc import Callable, Collection, Generator, Mapping
from enum import Enum
from typing import IO, Any, NoReturn, TypeVar, overload

import orjson
import rapidjson
from django.db.models.query import QuerySet
from django.utils.encoding import force_str
from django.utils.functional import Promise
from django.utils.safestring import SafeString, mark_safe
from django.utils.timezone import is_aware
from simplejson import _default_decoder  # type: ignore[attr-defined]  # noqa: S003
from simplejson import JSONDecodeError, JSONEncoder  # noqa: S003

from bitfield.types import BitHandler

TKey = TypeVar("TKey")
TValue = TypeVar("TValue")


def datetime_to_str(o: datetime.datetime) -> str:
    return o.strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def better_default_encoder(o: object) -> object:

    if isinstance(o, uuid.UUID):
        return o.hex
    elif isinstance(o, datetime.datetime):
        return datetime_to_str(o)
    elif isinstance(o, datetime.date):
        return o.isoformat()
    elif isinstance(o, datetime.time):
        if is_aware(o):
            raise ValueError("JSON can't represent timezone-aware times.")
        r = o.isoformat()
        if o.microsecond:
            r = r[:12]
        return r
    elif isinstance(o, (set, frozenset)):
        return list(o)
    elif isinstance(o, decimal.Decimal):
        return str(o)
    elif isinstance(o, Enum):
        return o.value
    elif isinstance(o, BitHandler):
        return int(o)
    elif callable(o):
        return "<function>"
    elif isinstance(o, QuerySet):
        return list(o)
    # serialization for certain Django objects here: https://docs.djangoproject.com/en/1.8/topics/serialization/
    elif isinstance(o, Promise):
        return force_str(o)
    raise TypeError(repr(o) + " is not JSON serializable")


class JSONEncoderForHTML(JSONEncoder):
    # Our variant of JSONEncoderForHTML that also accounts for apostrophes
    # See: https://github.com/simplejson/simplejson/blob/master/simplejson/encoder.py
    def encode(self, o: object) -> str:
        # Override JSONEncoder.encode because it has hacks for
        # performance that make things more complicated.
        chunks = self.iterencode(o, True)
        return "".join(chunks)

    def iterencode(self, o: object, _one_shot: bool = False) -> Generator[str]:
        chunks = super().iterencode(o, _one_shot)
        for chunk in chunks:
            chunk = chunk.replace("&", "\\u0026")
            chunk = chunk.replace("<", "\\u003c")
            chunk = chunk.replace(">", "\\u003e")
            chunk = chunk.replace("'", "\\u0027")
            yield chunk


_default_encoder = JSONEncoder(
    # upstream: (', ', ': ')
    # Ours eliminates whitespace.
    separators=(",", ":"),
    # upstream: False
    # True makes nan, inf, -inf serialize as null in compliance with ECMA-262.
    ignore_nan=True,
    default=better_default_encoder,
)

_default_escaped_encoder = JSONEncoderForHTML(
    separators=(",", ":"),
    ignore_nan=True,
    default=better_default_encoder,
)


# NoReturn here is to make this a mypy error to pass kwargs, since they are currently silently dropped
def dump(value: Any, fp: IO[str], **kwargs: NoReturn) -> None:
    for chunk in _default_encoder.iterencode(value):
        fp.write(chunk)


# NoReturn here is to make this a mypy error to pass kwargs, since they are currently silently dropped
def dumps(value: Any, escape: bool = False, **kwargs: NoReturn) -> str:
    # Legacy use. Do not use. Use dumps_htmlsafe
    if escape:
        return _default_escaped_encoder.encode(value)
    return _default_encoder.encode(value)


# NoReturn here is to make this a mypy error to pass kwargs, since they are currently silently dropped
def load(fp: IO[str] | IO[bytes], **kwargs: NoReturn) -> Any:
    return loads(fp.read())


# NoReturn here is to make this a mypy error to pass kwargs, since they are currently silently dropped
def loads(value: str | bytes, use_rapid_json: bool = False, **kwargs: NoReturn) -> Any:
    if use_rapid_json is True:
        return rapidjson.loads(value)
    else:
        return _default_decoder.decode(value)


# dumps JSON with `orjson` or the default function depending on `option_name`
# TODO: remove this when orjson experiment is successful
def dumps_experimental(option_name: str, data: Any) -> str:
    from sentry.options.rollout import in_random_rollout

    if in_random_rollout(option_name):
        return orjson.dumps(data).decode()
    else:
        return dumps(data)


def dumps_htmlsafe(value: object) -> SafeString:
    return mark_safe(_default_escaped_encoder.encode(value))


@overload
def prune_empty_keys(obj: None) -> None: ...


@overload
def prune_empty_keys(obj: Mapping[TKey, TValue | None]) -> dict[TKey, TValue]: ...


def prune_empty_keys(obj: Mapping[TKey, TValue | None] | None) -> dict[TKey, TValue] | None:
    if obj is None:
        return None

    # eliminate None values for serialization to compress the keyspace
    # and save (seriously) ridiculous amounts of bytes
    #
    # Do not coerce empty arrays/dicts or other "falsy" values here to None,
    # but rather deal with them case-by-case before calling `prune_empty_keys`
    # (e.g. in `Interface.to_json`). Rarely, but sometimes, there's a slight
    # semantic difference between empty containers and a missing value. One
    # example would be `event.logentry.formatted`, where `{}` means "this
    # message has no params" and `None` means "this message is already
    # formatted".
    return {k: v for k, v in obj.items() if v is not None}


def apply_key_filter(
    obj: Mapping[TKey, TValue],
    *,
    keep_keys: Collection[TKey] | None = None,
    key_filter: Callable[[TKey], bool] | None = None,
) -> dict[TKey, TValue]:
    """
    A version of the built-in `filter` function which works on dictionaries, returning a (filtered)
    shallow copy of the original.

    If `keep_keys` is given, any key-value pair whose key isn't in `keep_keys` will be excluded from
    the result.

    If a `key_filter` function is given, any key-value pair for which `key_filter(key)` is False
    will be excluded from the result.

    If both are given, `keep_keys` takes precedence. If neither is given, an unfiltered shallow copy
    of the original is returned.
    """

    if keep_keys:
        key_filter = lambda key: key in keep_keys
    elif not keep_keys and not key_filter:
        key_filter = lambda _key: True

    # `key_filter` can't be None by now, but mypy still thinks it might
    assert key_filter

    return {key: obj[key] for key in obj if key_filter(key)}


__all__ = (
    "JSONDecodeError",
    "JSONEncoder",
    "dump",
    "dumps",
    "dumps_htmlsafe",
    "load",
    "loads",
    "prune_empty_keys",
    "apply_key_filter",
)
