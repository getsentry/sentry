from __future__ import annotations

from collections.abc import Callable
from typing import Any

from asgiref.sync import iscoroutinefunction, markcoroutinefunction
from django.http.response import HttpResponseBase
from rest_framework.request import Request

from . import proxy_request_if_needed


class ApiGatewayMiddleware:
    """Proxy requests intended for remote silos"""

    async_capable = True
    sync_capable = False

    def __init__(self, get_response: Callable[[Request], HttpResponseBase]):
        self.get_response = get_response
        markcoroutinefunction(self)
        # NOTE: this shouldn't be necessary, but for $REASONS Django's middleware
        #       sync-async code patches won't recognize `process_view` as async.
        #       The following line does.
        markcoroutinefunction(self.process_view)

    def __call__(self, request: Request) -> Any:
        if iscoroutinefunction(self):
            return self.__acall__(request)
        return self.get_response(request)

    async def __acall__(self, request: Request) -> HttpResponseBase:
        return await self.get_response(request)  # type: ignore[misc]

    async def process_view(
        self,
        request: Request,
        view_func: Callable[..., HttpResponseBase],
        view_args: tuple[str],
        view_kwargs: dict[str, Any],
    ) -> HttpResponseBase | None:
        proxy_response = await proxy_request_if_needed(request, view_func, view_kwargs)
        if proxy_response is not None:
            return proxy_response
        return None
