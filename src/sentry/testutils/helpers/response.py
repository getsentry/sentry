from __future__ import annotations

from typing import TypeGuard

from django.http.response import HttpResponseBase, StreamingHttpResponse
from rest_framework.response import Response


def is_drf_response(response: HttpResponseBase) -> TypeGuard[Response]:
    """workaround for typeddjango/django-stubs#2683"""
    return isinstance(response, Response)


def is_streaming_response(response: HttpResponseBase) -> TypeGuard[StreamingHttpResponse]:
    """workaround for typeddjango/django-stubs#2683"""
    return isinstance(response, StreamingHttpResponse)


def close_streaming_response(response: HttpResponseBase) -> bytes:
    """Exhausts the streamed file in a response.

    When the file is exahusted, this underlying file descriptor is closed
    avoiding a `ResourceWarning`.
    """
    assert isinstance(response, StreamingHttpResponse)
    return response.getvalue()
