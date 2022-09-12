# This future-import is load-bearing, as `hashlib._Hash` is not actually importable.
from __future__ import annotations

import hashlib
from hashlib import md5 as _md5
from hashlib import sha1 as _sha1
from typing import Any, Callable, Iterable, Optional

from django.utils.encoding import force_bytes


def md5_text(*args: Any) -> hashlib._Hash:
    m = _md5()
    for x in args:
        m.update(force_bytes(x, errors="replace"))
    return m


def sha1_text(*args: Any) -> hashlib._Hash:
    m = _sha1()
    for x in args:
        m.update(force_bytes(x, errors="replace"))
    return m


def hash_value(h: hashlib._Hash, value: Any) -> None:
    if value is None:
        h.update(b"\x00")
    elif value is True:
        h.update(b"\x01")
    elif value is False:
        h.update(b"\x02")
    elif isinstance(value, int):
        h.update(b"\x03" + str(value).encode("ascii") + b"\x00")
    elif isinstance(value, (tuple, list)):
        h.update(b"\x04" + str(len(value)).encode("utf-8"))
        for item in value:
            hash_value(h, item)
    elif isinstance(value, dict):
        h.update(b"\x05" + str(len(value)).encode("utf-8"))
        for k, v in sorted(value.items()):
            hash_value(h, k)
            hash_value(h, v)
    elif isinstance(value, bytes):
        h.update(b"\x06" + value + b"\x00")
    elif isinstance(value, str):
        h.update(b"\x07" + value.encode("utf-8") + b"\x00")
    else:
        raise TypeError("Invalid hash value")


def hash_values(
    values: Iterable[Any],
    seed: Optional[str] = None,
    algorithm: Callable[[], hashlib._Hash] = _md5,
) -> str:
    h = _md5()
    if seed is not None:
        h.update(("%s\xff" % seed).encode("utf-8"))
    for value in values:
        hash_value(h, value)
    return h.hexdigest()
