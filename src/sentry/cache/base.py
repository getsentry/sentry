from threading import local
from typing import Any

import sentry_sdk
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

    def __init__(self, version=None, prefix=None, is_default_cache=False):
        self.version = version or settings.CACHE_VERSION
        if prefix is not None:
            self.prefix = prefix

        self.is_default_cache = is_default_cache

    def make_key(self, key, version=None) -> str:
        return wrap_key(self.prefix, version or self.version, key)

    def set(self, key, value, timeout, version=None, raw=False):
        raise NotImplementedError

    def delete(self, key, version=None):
        raise NotImplementedError

    def get(self, key, version=None, raw=False):
        raise NotImplementedError

    def _mark_transaction(self, op):
        """
        Mark transaction with a tag so we can identify system components that rely
        on the default cache as potential SPOF.
        """
        if not self.is_default_cache:
            return

        with sentry_sdk.configure_scope() as scope:
            # Do not set this tag if we're in the global scope (which roughly
            # equates to having a transaction).
            if scope.transaction:
                scope.set_tag(f"{op}_default_cache", "true")
                scope.set_tag("used_default_cache", "true")
