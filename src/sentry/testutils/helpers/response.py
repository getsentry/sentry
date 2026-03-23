from __future__ import annotations

from typing import TypeGuard

from asgiref.sync import async_to_sync
from django.http.response import HttpResponseBase, StreamingHttpResponse
from rest_framework.response import Response


def is_drf_response(response: HttpResponseBase) -> TypeGuard[Response]:
    """workaround for typeddjango/django-stubs#2683"""
    return isinstance(response, Response)


def is_streaming_response(response: HttpResponseBase) -> TypeGuard[StreamingHttpResponse]:
    """workaround for typeddjango/django-stubs#2683"""
    return isinstance(response, StreamingHttpResponse)


async def _async_streaming_response_content(response: StreamingHttpResponse):
    data = []
    async for chunk in response:
        data.append(chunk)
    return b"".join(data)


def close_streaming_response(response: HttpResponseBase) -> bytes:
    """Exhausts the streamed file in a response.

    When the file is exhausted, the underlying file descriptor is closed
    avoiding a `ResourceWarning`.
    """
    assert isinstance(response, StreamingHttpResponse)
    if response.is_async:
        return async_to_sync(_async_streaming_response_content)(response)
    return response.getvalue()
