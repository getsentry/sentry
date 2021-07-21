# Avoid shadowing the standard library json module

# XXX(epurkhiser): We import JSONDecodeError just to have it be exported as
# part of this module. We don't use it directly within the module, but modules
# that import it from here will. Do not remove.

import datetime
import decimal
import uuid
from enum import Enum
from typing import Any

import rapidjson
import sentry_sdk
from django.utils.encoding import force_text
from django.utils.functional import Promise
from django.utils.safestring import mark_safe
from django.utils.timezone import is_aware
from simplejson import JSONDecodeError, JSONEncoder, _default_decoder  # NOQA

from bitfield.types import BitHandler


def better_default_encoder(o):
    if isinstance(o, uuid.UUID):
        return o.hex
    elif isinstance(o, datetime.datetime):
        return o.strftime("%Y-%m-%dT%H:%M:%S.%fZ")
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
    # serialization for certain Django objects here: https://docs.djangoproject.com/en/1.8/topics/serialization/
    elif isinstance(o, Promise):
        return force_text(o)
    raise TypeError(repr(o) + " is not JSON serializable")


class JSONEncoderForHTML(JSONEncoder):
    # Our variant of JSONEncoderForHTML that also accounts for apostrophes
    # See: https://github.com/simplejson/simplejson/blob/master/simplejson/encoder.py
    def encode(self, o):
        # Override JSONEncoder.encode because it has hacks for
        # performance that make things more complicated.
        chunks = self.iterencode(o, True)
        return "".join(chunks)

    def iterencode(self, o, _one_shot=False):
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


JSONData = Any  # https://github.com/python/typing/issues/182


def dump(value: JSONData, fp, **kwargs):
    for chunk in _default_encoder.iterencode(value):
        fp.write(chunk)


def dumps(value: JSONData, escape: bool = False, **kwargs) -> str:
    # Legacy use. Do not use. Use dumps_htmlsafe
    if escape:
        return _default_escaped_encoder.encode(value)
    return _default_encoder.encode(value)


def load(fp, **kwargs) -> JSONData:
    return loads(fp.read())


def loads(value: str, use_rapid_json: bool = False, **kwargs) -> JSONData:
    with sentry_sdk.start_span(op="sentry.utils.json.loads"):
        if use_rapid_json is True:
            return rapidjson.loads(value)
        else:
            return _default_decoder.decode(value)


def dumps_htmlsafe(value):
    return mark_safe(_default_escaped_encoder.encode(value))


def prune_empty_keys(obj):
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
