from __future__ import annotations

import time
from typing import Any

from django.conf import settings
from django.http import Http404
from django.utils.deprecation import MiddlewareMixin
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.utils import metrics

from . import ViewFunc, get_path, is_frontend_request


def add_request_metric_tags(request: Request, **kwargs: Any) -> None:
    metric_tags = getattr(request, "_metric_tags", {})
    setattr(request, "_metric_tags", {**metric_tags, **kwargs})


class ResponseCodeMiddleware(MiddlewareMixin):
    def process_response(self, request: Request, response: Response) -> Response:
        metrics.incr("response", instance=str(response.status_code), skip_internal=False)
        return response

    def process_exception(self, request: Request, exception: Exception) -> None:
        if not isinstance(exception, Http404):
            metrics.incr("response", instance="500", skip_internal=False)


class RequestTimingMiddleware(MiddlewareMixin):
    allowed_methods = ("POST", "GET", "PUT", "DELETE")
    allowed_paths = getattr(
        settings, "SENTRY_REQUEST_METRIC_ALLOWED_PATHS", ("sentry.web.api", "sentry.api.endpoints")
    )  # Store endpoints

    def process_view(
        self,
        request: Request,
        view_func: ViewFunc,
        view_args: Any,
        view_kwargs: Any,
    ) -> Response | None:
        add_request_metric_tags(request)

        if request.method not in self.allowed_methods:
            return None

        path = get_path(view_func)
        if path and path.startswith(self.allowed_paths):
            setattr(request, "_view_path", path)
            setattr(request, "_start_time", time.time())
        return None

    def process_response(self, request: Request, response: Response) -> Response:
        self._record_time(request, response.status_code)
        return response

    def process_exception(self, request: Request, exception: Exception) -> None:
        self._record_time(request, 500)

    @staticmethod
    def _record_time(request: Request, status_code: int) -> None:
        view_path = getattr(request, "_view_path", None)
        if not view_path:
            return

        rate_limit_type = getattr(
            getattr(request, "rate_limit_metadata", None), "rate_limit_type", None
        )

        tags = getattr(request, "_metric_tags", {})
        tags.update(
            {
                "method": request.method,
                "status_code": status_code,
                "ui_request": is_frontend_request(request),
                "rate_limit_type": getattr(rate_limit_type, "value", None)
                if rate_limit_type
                else None,
            }
        )
        metrics.incr("view.response", instance=view_path, tags=tags, skip_internal=False)

        start_time = getattr(request, "_start_time", None)
        if not start_time:
            return

        ms = int((time.time() - start_time) * 1000)
        metrics.distribution(
            "view.duration",
            ms,
            instance=view_path,
            tags={"method": request.method},
            unit="millisecond",
        )
