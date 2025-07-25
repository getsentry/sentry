from __future__ import annotations

import logging
import time
from collections.abc import Callable
from dataclasses import dataclass

from django.conf import settings
from django.utils.encoding import force_str
from rest_framework.authentication import get_authorization_header
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.auth.services.auth import AuthenticatedToken
from sentry.types.ratelimit import RateLimitMeta, SnubaRateLimitMeta
from sentry.utils import metrics

from . import is_frontend_request

api_access_logger = logging.getLogger("sentry.access.api")

EXCLUSION_PATHS = settings.ACCESS_LOGS_EXCLUDE_PATHS + settings.ANONYMOUS_STATIC_PREFIXES


@dataclass
class _AccessLogMetaData:
    request_start_time: float

    def get_request_duration(self) -> float:
        return time.time() - self.request_start_time


def _get_request_auth(request: Request) -> AuthenticatedToken | None:
    if request.path_info.startswith(settings.ANONYMOUS_STATIC_PREFIXES):
        return None
    # may not be present if request was rejected by a middleware between this
    # and the auth middleware
    return getattr(request, "auth", None)


def _get_token_name(auth: AuthenticatedToken | None) -> str | None:
    if auth is None:
        return None
    elif isinstance(auth, AuthenticatedToken):
        return auth.kind
    else:
        raise AssertionError(f"unreachable: {auth}")


def _get_rate_limit_stats_dict(request: Request) -> dict[str, str]:

    rate_limit_metadata: RateLimitMeta | None = getattr(request, "rate_limit_metadata", None)
    snuba_rate_limit_metadata: SnubaRateLimitMeta | None = getattr(
        request, "snuba_rate_limit_metadata", None
    )

    rate_limit_type = "DNE"
    if rate_limit_metadata:
        rate_limit_type = str(getattr(rate_limit_metadata, "rate_limit_type", "DNE"))
    elif snuba_rate_limit_metadata:
        rate_limit_type = "RateLimitType.SNUBA"

    rate_limit_stats = {
        "rate_limit_type": rate_limit_type,
        "concurrent_limit": str(getattr(rate_limit_metadata, "concurrent_limit", None)),
        "concurrent_requests": str(getattr(rate_limit_metadata, "concurrent_requests", None)),
        "reset_time": str(getattr(rate_limit_metadata, "reset_time", None)),
        "group": str(getattr(rate_limit_metadata, "group", None)),
        "limit": str(getattr(rate_limit_metadata, "limit", None)),
        "remaining": str(getattr(rate_limit_metadata, "remaining", None)),
        # We prefix the snuba fields with snuba_ to avoid confusion with the standard rate limit metadata
        "snuba_policy": str(getattr(snuba_rate_limit_metadata, "policy", None)),
        "snuba_quota_used": str(getattr(snuba_rate_limit_metadata, "quota_used", None)),
        "snuba_rejection_threshold": str(
            getattr(snuba_rate_limit_metadata, "rejection_threshold", None)
        ),
        "snuba_suggestion": str(getattr(snuba_rate_limit_metadata, "suggestion", None)),
    }

    return rate_limit_stats


def _create_api_access_log(
    request: Request, response: Response | None, access_log_metadata: _AccessLogMetaData
) -> None:
    """
    Create a log entry to be used for api metrics gathering
    """
    try:
        if request.resolver_match is None:
            view = "Unknown"
        else:
            view = request.resolver_match._func_path

        request_auth = _get_request_auth(request)
        token_type = str(_get_token_name(request_auth))
        if token_type == "system":
            # if its an internal request, no need to log
            return

        request_user = getattr(request, "user", None)
        user_id = getattr(request_user, "id", None)
        is_app = getattr(request_user, "is_sentry_app", None)
        org_id = getattr(getattr(request, "organization", None), "id", None)
        auth_id = getattr(request_auth, "id", None)
        status_code = getattr(response, "status_code", 500)
        log_metrics = dict(
            method=str(request.method),
            view=view,
            response=status_code,
            user_id=str(user_id),
            is_app=str(is_app),
            token_type=token_type,
            is_frontend_request=str(is_frontend_request(request)),
            organization_id=str(org_id),
            auth_id=str(auth_id),
            path=str(request.path),
            caller_ip=str(request.META.get("REMOTE_ADDR")),
            user_agent=str(request.META.get("HTTP_USER_AGENT")),
            rate_limited=str(getattr(request, "will_be_rate_limited", False)),
            rate_limit_category=str(getattr(request, "rate_limit_category", None)),
            request_duration_seconds=access_log_metadata.get_request_duration(),
            **_get_rate_limit_stats_dict(request),
        )
        auth = get_authorization_header(request).split()
        if len(auth) == 2:
            log_metrics["token_last_characters"] = force_str(auth[1])[-4:]
        api_access_logger.info("api.access", extra=log_metrics)
        metrics.incr("middleware.access_log.created")
    except Exception:
        api_access_logger.exception("api.access: Error capturing API access logs")


def access_log_middleware(
    get_response: Callable[[Request], Response]
) -> Callable[[Request], Response]:
    def middleware(request: Request) -> Response:
        # NOTE(Vlad): `request.auth|user` are not a simple member accesses,
        # they make DB calls. For static urls that should not happen. Hence
        # this middleware is skipped for them. We don't care about its access
        # that much anyways

        if not settings.LOG_API_ACCESS:
            return get_response(request)

        if request.path_info.startswith(EXCLUSION_PATHS):
            return get_response(request)

        access_log_metadata = _AccessLogMetaData(request_start_time=time.time())
        response = get_response(request)
        _create_api_access_log(request, response, access_log_metadata)
        return response

    return middleware
