from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Any

from asgiref.sync import async_to_sync, iscoroutinefunction, markcoroutinefunction
from django.http.response import HttpResponseBase
from rest_framework.request import Request

from sentry.hybridcloud.apigateway import proxy_request_if_needed


class ApiGatewayMiddleware:
    """Proxy requests intended for remote silos"""

    async_capable = True
    sync_capable = True

    def __init__(self, get_response: Callable[[Request], HttpResponseBase]):
        self.get_response = get_response
        if iscoroutinefunction(self.get_response):
            markcoroutinefunction(self)

    def __call__(self, request: Request) -> Any:
        if iscoroutinefunction(self):
            return self.__acall__(request)
        return self.get_response(request)

    async def __acall__(self, request: Request) -> HttpResponseBase:
        return await self.get_response(request)  # type: ignore[misc]

    def process_view(
        self,
        request: Request,
        view_func: Callable[..., HttpResponseBase],
        view_args: tuple[str],
        view_kwargs: dict[str, Any],
    ) -> HttpResponseBase | None:
        return self._process_view_match(request, view_func, view_args, view_kwargs)

    def _process_view_match(
        self,
        request: Request,
        view_func: Callable[..., HttpResponseBase],
        view_args: tuple[str],
        view_kwargs: dict[str, Any],
    ) -> Any:
        #: we check if we're in an async or sync runtime once, then
        #  overwrite the method with the actual impl.
        try:
            asyncio.get_running_loop()
            method = self._process_view_inner
        except RuntimeError:
            method = self._process_view_sync  # type: ignore[assignment]
        setattr(self, "_process_view_match", method)
        return method(request, view_func, view_args, view_kwargs)

    def _process_view_sync(
        self,
        request: Request,
        view_func: Callable[..., HttpResponseBase],
        view_args: tuple[str],
        view_kwargs: dict[str, Any],
    ) -> HttpResponseBase | None:
        return async_to_sync(self._process_view_inner)(request, view_func, view_args, view_kwargs)

    async def _process_view_inner(
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
