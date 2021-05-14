from threading import local
from typing import Any

from django.conf import settings


def wrap_key(prefix: str, version: Any, key: Any) -> str:
    return f"{prefix}:{version}:{key}"


def unwrap_key(prefix: str, version: Any, value: str) -> str:
    header = f"{prefix}:{version}"
    if value[: len(header)] != header:
        raise ValueError("invalid key header")
    return value[len(header) + 1 :]


class BaseCache(local):
    prefix = "c"

    def __init__(self, version=None, prefix=None):
        self.version = version or settings.CACHE_VERSION
        if prefix is not None:
            self.prefix = prefix

    def make_key(self, key, version=None) -> str:
        return wrap_key(self.prefix, version or self.version, key)

    def set(self, key, value, timeout, version=None, raw=False):
        raise NotImplementedError

    def delete(self, key, version=None):
        raise NotImplementedError

    def get(self, key, version=None, raw=False):
        raise NotImplementedError
