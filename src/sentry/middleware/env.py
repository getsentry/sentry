from typing import int
from collections.abc import Callable

from django.http.request import HttpRequest
from django.http.response import HttpResponseBase

from sentry.app import env


def SentryEnvMiddleware(
    get_response: Callable[[HttpRequest], HttpResponseBase],
) -> Callable[[HttpRequest], HttpResponseBase]:
    def SentryEnvMiddleware_impl(request: HttpRequest) -> HttpResponseBase:
        with env.active_request(request):
            return get_response(request)

    return SentryEnvMiddleware_impl
