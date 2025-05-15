import functools
from typing import TYPE_CHECKING
from sentry_sdk_alpha.integrations.redis.utils import _get_safe_key, _key_as_string
from urllib3.util import parse_url as urlparse

from django import VERSION as DJANGO_VERSION
from django.core.cache import CacheHandler

import sentry_sdk_alpha
from sentry_sdk_alpha.consts import OP, SPANDATA
from sentry_sdk_alpha.utils import (
    capture_internal_exceptions,
    ensure_integration_enabled,
)


if TYPE_CHECKING:
    from typing import Any
    from typing import Callable
    from typing import Optional


METHODS_TO_INSTRUMENT = [
    "set",
    "set_many",
    "get",
    "get_many",
]


def _get_span_description(method_name, args, kwargs):
    # type: (str, tuple[Any], dict[str, Any]) -> str
    return _key_as_string(_get_safe_key(method_name, args, kwargs))


def _patch_cache_method(cache, method_name, address, port):
    # type: (CacheHandler, str, Optional[str], Optional[int]) -> None
    from sentry_sdk_alpha.integrations.django import DjangoIntegration

    original_method = getattr(cache, method_name)

    @ensure_integration_enabled(DjangoIntegration, original_method)
    def _instrument_call(
        cache, method_name, original_method, args, kwargs, address, port
    ):
        # type: (CacheHandler, str, Callable[..., Any], tuple[Any, ...], dict[str, Any], Optional[str], Optional[int]) -> Any
        is_set_operation = method_name.startswith("set")
        is_get_operation = not is_set_operation

        op = OP.CACHE_PUT if is_set_operation else OP.CACHE_GET
        description = _get_span_description(method_name, args, kwargs)

        with sentry_sdk_alpha.start_span(
            op=op,
            name=description,
            origin=DjangoIntegration.origin,
            only_if_parent=True,
        ) as span:
            value = original_method(*args, **kwargs)

            with capture_internal_exceptions():
                if address is not None:
                    span.set_attribute(SPANDATA.NETWORK_PEER_ADDRESS, address)

                if port is not None:
                    span.set_attribute(SPANDATA.NETWORK_PEER_PORT, port)

                key = _get_safe_key(method_name, args, kwargs)
                if key is not None:
                    span.set_attribute(SPANDATA.CACHE_KEY, key)

                item_size = None
                if is_get_operation:
                    if value:
                        item_size = len(str(value))
                        span.set_attribute(SPANDATA.CACHE_HIT, True)
                    else:
                        span.set_attribute(SPANDATA.CACHE_HIT, False)
                else:  # TODO: We don't handle `get_or_set` which we should
                    arg_count = len(args)
                    if arg_count >= 2:
                        # 'set' command
                        item_size = len(str(args[1]))
                    elif arg_count == 1:
                        # 'set_many' command
                        item_size = len(str(args[0]))

                if item_size is not None:
                    span.set_attribute(SPANDATA.CACHE_ITEM_SIZE, item_size)

            return value

    @functools.wraps(original_method)
    def sentry_method(*args, **kwargs):
        # type: (*Any, **Any) -> Any
        return _instrument_call(
            cache, method_name, original_method, args, kwargs, address, port
        )

    setattr(cache, method_name, sentry_method)


def _patch_cache(cache, address=None, port=None):
    # type: (CacheHandler, Optional[str], Optional[int]) -> None
    if not hasattr(cache, "_sentry_patched"):
        for method_name in METHODS_TO_INSTRUMENT:
            _patch_cache_method(cache, method_name, address, port)
        cache._sentry_patched = True


def _get_address_port(settings):
    # type: (dict[str, Any]) -> tuple[Optional[str], Optional[int]]
    location = settings.get("LOCATION")

    # TODO: location can also be an array of locations
    #       see: https://docs.djangoproject.com/en/5.0/topics/cache/#redis
    #       GitHub issue: https://github.com/getsentry/sentry-python/issues/3062
    if not isinstance(location, str):
        return None, None

    if "://" in location:
        parsed_url = urlparse(location)
        # remove the username and password from URL to not leak sensitive data.
        address = "{}://{}{}".format(
            parsed_url.scheme or "",
            parsed_url.hostname or "",
            parsed_url.path or "",
        )
        port = parsed_url.port
    else:
        address = location
        port = None

    return address, int(port) if port is not None else None


def patch_caching():
    # type: () -> None
    from sentry_sdk_alpha.integrations.django import DjangoIntegration

    if not hasattr(CacheHandler, "_sentry_patched"):
        if DJANGO_VERSION < (3, 2):
            original_get_item = CacheHandler.__getitem__

            @functools.wraps(original_get_item)
            def sentry_get_item(self, alias):
                # type: (CacheHandler, str) -> Any
                cache = original_get_item(self, alias)

                integration = sentry_sdk_alpha.get_client().get_integration(DjangoIntegration)
                if integration is not None and integration.cache_spans:
                    from django.conf import settings

                    address, port = _get_address_port(
                        settings.CACHES[alias or "default"]
                    )

                    _patch_cache(cache, address, port)

                return cache

            CacheHandler.__getitem__ = sentry_get_item
            CacheHandler._sentry_patched = True

        else:
            original_create_connection = CacheHandler.create_connection

            @functools.wraps(original_create_connection)
            def sentry_create_connection(self, alias):
                # type: (CacheHandler, str) -> Any
                cache = original_create_connection(self, alias)

                integration = sentry_sdk_alpha.get_client().get_integration(DjangoIntegration)
                if integration is not None and integration.cache_spans:
                    address, port = _get_address_port(self.settings[alias or "default"])

                    _patch_cache(cache, address, port)

                return cache

            CacheHandler.create_connection = sentry_create_connection
            CacheHandler._sentry_patched = True
