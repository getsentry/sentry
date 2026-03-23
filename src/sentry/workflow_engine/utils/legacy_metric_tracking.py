"""
Utilities for tracking legacy AlertRule and Rule model usage in API endpoints.

This module provides a decorator and reporting mechanism to track which endpoints
are using legacy AlertRule and Rule models vs the new workflow engine models. This
helps with migration progress tracking.
"""

from __future__ import annotations

import functools
from collections.abc import Callable
from contextvars import ContextVar
from typing import Any, Literal, TypeVar

import sentry_sdk
from django.http import HttpResponseBase

from sentry.utils import metrics

# ContextVar to track whether legacy models were used in the current request context
_legacy_models_used: ContextVar[bool] = ContextVar("legacy_models_used", default=False)

T = TypeVar("T", bound=HttpResponseBase)


def report_used_legacy_models() -> None:
    """
    Mark the current request context as having used legacy AlertRule or Rule models.

    This should be called from:
    - Serializers that serialize AlertRule, Rule, or related models
    - Immediately after ORM queries that fetch AlertRule or Rule objects
    - When creating or updating AlertRule or Rule instances

    The value is tracked in a ContextVar and will be read when the
    track_alert_endpoint_execution decorator exits.
    """
    _legacy_models_used.set(True)


# Since backported API implementations should be functionally equivalent to the
# legacy implementations, it's helpful to include this header to make it explicit
# which was used so that testers and bug reporters can confirm the source of their data.
_LEGACY_MODELS_HEADER = "X-Legacy-Models"


def track_alert_endpoint_execution(
    method: Literal["GET", "POST", "PUT", "DELETE", "PATCH"],
    route_name: str,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    Decorator to track execution of alert-related endpoints and report metrics.

    This decorator:
    1. Sets up a ContextVar context for tracking legacy model usage
    2. Executes the endpoint method
    3. Reports a metric with whether legacy models were used

    Args:
        method: HTTP method (e.g., "GET", "POST", "PUT", "DELETE")
        route_name: Django route name for the endpoint (e.g.,
                   "sentry-api-0-organization-alert-rule-details")

    Usage:
        @track_alert_endpoint_execution("GET", "sentry-api-0-organization-alert-rule-details")
        def get(self, request: Request, organization: Organization) -> Response:
            ...
    """

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            # Reset the context var for this request
            token = _legacy_models_used.set(False)

            legacy_models: bool | None = None
            try:
                # Execute the endpoint
                response = func(*args, **kwargs)
                if isinstance(response, HttpResponseBase):
                    legacy_models = _legacy_models_used.get()
                    if not response.has_header(_LEGACY_MODELS_HEADER):
                        response.headers[_LEGACY_MODELS_HEADER] = str(legacy_models).lower()
                return response
            finally:
                if legacy_models is None:
                    legacy_models = _legacy_models_used.get()

                metrics.incr(
                    "alert_endpoint.executed",
                    tags={
                        "endpoint": route_name,
                        "method": method,
                        "legacy_models": str(legacy_models).lower(),
                    },
                )
                # Tag our spans so we can more easily do bulk analysis on them in Sentry.
                sentry_sdk.get_isolation_scope().set_tag(
                    "legacy_models", str(legacy_models).lower()
                )
                # Reset the context var
                _legacy_models_used.reset(token)

        return wrapper

    return decorator
