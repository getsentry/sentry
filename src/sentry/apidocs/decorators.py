from typing import Any, Callable

from sentry.api.base import Endpoint

from .hooks import HTTP_METHODS_SET, PUBLIC_ENDPOINTS


def public(methods: HTTP_METHODS_SET) -> Callable[[Any], Any]:
    def decorate(view_cls: Endpoint) -> Endpoint:

        PUBLIC_ENDPOINTS[view_cls.__name__] = {
            "methods": methods,
        }

        return view_cls

    return decorate
