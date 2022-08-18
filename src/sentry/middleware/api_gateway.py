from __future__ import annotations

from typing import Callable

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api_gateway import proxy_request_if_needed


def api_gateway_middleware(
    get_response: Callable[[Request], Response]
) -> Callable[[Request], Response]:
    def middleware(request: Request) -> Response:
        proxy_response = proxy_request_if_needed(request)
        return proxy_response if proxy_response is not None else get_response(request)

    return middleware
