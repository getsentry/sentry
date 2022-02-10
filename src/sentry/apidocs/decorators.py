from typing import Any, Callable

from sentry.api.base import Endpoint

from ..api.base import VersionedEndpoint
from .hooks import HTTP_METHODS_SET, PUBLIC_ENDPOINTS


def public(methods: HTTP_METHODS_SET) -> Callable[[Any], Any]:
    def decorate(view_cls: Endpoint) -> Endpoint:

        PUBLIC_ENDPOINTS[view_cls.__name__] = {
            "methods": methods,
            "versions": (
                list(view_cls.declare_method_versions())
                if issubclass(view_cls, VersionedEndpoint)
                else None
            ),
        }

        return view_cls

    return decorate
