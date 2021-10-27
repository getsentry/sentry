from typing import Any, Callable

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.utils.hashlib import md5_text

# TODO(mgaeta): It's not currently possible to type a Callable's args with kwargs.
EndpointFunction = Callable[..., Response]


def build_rate_limit_key(function: EndpointFunction, request: Request) -> str:
    ip = request.META["REMOTE_ADDR"]
    return f"rate_limit_endpoint:{md5_text(function.__qualname__).hexdigest()}:{ip}"


def rate_limit_endpoint(limit: int = 1, window: int = 1) -> EndpointFunction:
    def inner(function: EndpointFunction) -> EndpointFunction:
        def wrapper(self: Any, request: Request, *args: Any, **kwargs: Any) -> Response:
            return function(
                self,
                request,
                *args,
                limit=limit,
                window=window,
                enforce_limit=True,
                **kwargs,
            )

        return wrapper

    return inner
