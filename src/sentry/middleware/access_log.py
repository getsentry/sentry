from __future__ import annotations

import logging
import time
from dataclasses import dataclass

from django.utils.deprecation import MiddlewareMixin
from rest_framework.request import Request
from rest_framework.response import Response

api_access_logger = logging.getLogger("sentry.access.api")


@dataclass
class _AccessLogMetaData:
    request_start_time: float | None

    def get_request_duration(self) -> float | None:
        return time.time() - self.request_start_time if self.request_start_time else None


_empty_request_metadata = _AccessLogMetaData(request_start_time=None)


class AccessLogMiddleware(MiddlewareMixin):
    def _get_token_name(self, request: Request):
        auth = getattr(request, "auth", None)
        if not auth:
            return None
        token_class = getattr(auth, "__class__", None)
        return token_class.__name__ if token_class else None

    def _create_api_access_log(
        self, request: Request, response: Response | None, exception: Exception | None
    ):
        """
        Create a log entry to be used for api metrics gathering
        """
        try:
            try:
                view = request.resolver_match._func_path
            except AttributeError:
                view = "Unknown"

            request_user = getattr(request, "user", None)
            user_id = getattr(request_user, "id", None)
            is_app = getattr(request_user, "is_sentry_app", None)

            request_access = getattr(request, "access", None)
            org_id = getattr(request_access, "organization_id", None)

            request_auth = getattr(request, "auth", None)
            auth_id = getattr(request_auth, "id", None)
            access_log_metadata = getattr(request, "access_log_metadata", _empty_request_metadata)
            status_code = response.status_code if response else 500
            log_metrics = dict(
                method=str(request.method),
                view=view,
                response=status_code,
                user_id=str(user_id),
                is_app=str(is_app),
                token_type=str(self._get_token_name(request)),
                organization_id=str(org_id),
                auth_id=str(auth_id),
                path=str(request.path),
                caller_ip=str(request.META.get("REMOTE_ADDR")),
                user_agent=str(request.META.get("HTTP_USER_AGENT")),
                rate_limited=str(getattr(request, "will_be_rate_limited", False)),
                rate_limit_category=str(getattr(request, "rate_limit_category", None)),
                request_duration_seconds=access_log_metadata.get_request_duration(),
            )
            api_access_logger.info("api.access", extra=log_metrics)
        except Exception:
            api_access_logger.exception("api.access")

    def process_request(self, request: Request):
        request.access_log_metadata = _AccessLogMetaData(request_start_time=time.time())

    def process_response(self, request: Request, response: Response) -> Response:
        self._create_api_access_log(request, response, exception=None)
        return response

    def process_exception(self, request: Request, exception: Exception) -> Response:
        # NOTE: This function will likely never be hit because the sentry API endpoint
        # handles exceptions and wraps them in responses but this is here for completeness
        self._create_api_access_log(request, response=None, exception=exception)
        raise exception
