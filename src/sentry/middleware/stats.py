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
        if request.method not in self.allowed_methods:
            return None

        path = get_path(view_func)
        if path and path.startswith(self.allowed_paths):
            setattr(request, "_view_path", path)
            setattr(request, "_start_time", time.monotonic())

            view_class = getattr(view_func, "view_class", None)
            max_acceptable_duration = getattr(view_class, "max_acceptable_duration", None)
            if isinstance(max_acceptable_duration, dict):
                max_acceptable_duration = max_acceptable_duration.get(request.method)

            setattr(request, "_max_acceptable_duration", max_acceptable_duration)
            setattr(request, "_view_owner", getattr(view_class, "owner", None))
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

        if request.resolver_match is None or request.resolver_match.url_name is None:
            url_name = "unreachable-unknown"
        else:
            url_name = request.resolver_match.url_name

        rate_limit_type = getattr(
            getattr(request, "rate_limit_metadata", None), "rate_limit_type", None
        )

        tags = {
            "method": request.method,
            "status_code": status_code,
            "ui_request": is_frontend_request(request),
            "rate_limit_type": (
                getattr(rate_limit_type, "value", None) if rate_limit_type else None
            ),
            "url_name": url_name,
        }
        metrics.incr("view.response", instance=view_path, tags=tags, skip_internal=False)

        start_time = getattr(request, "_start_time", None)
        if start_time is None:
            return

        duration = time.monotonic() - start_time
        ms = int(duration * 1000)
        metrics.distribution(
            "view.duration",
            ms,
            instance=view_path,
            tags={"method": request.method},
            unit="millisecond",
        )

        max_acceptable_duration = getattr(request, "_max_acceptable_duration", None)
        if max_acceptable_duration is not None and duration > max_acceptable_duration:
            owner = getattr(request, "_view_owner", None)
            metrics.distribution(
                "view.duration_over_budget",
                (duration - max_acceptable_duration) * 1000,
                instance=view_path,
                tags={
                    "method": request.method,
                    "owner": getattr(owner, "value", owner),
                },
                sample_rate=1.0,
                unit="millisecond",
            )
