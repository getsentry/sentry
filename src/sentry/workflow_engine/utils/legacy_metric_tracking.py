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

            try:
                # Execute the endpoint
                response = func(*args, **kwargs)
                return response
            finally:
                # Report the metric after execution
                legacy_models = _legacy_models_used.get()

                metrics.incr(
                    "alert_endpoint.executed",
                    tags={
                        "endpoint": route_name,
                        "method": method,
                        "legacy_models": str(legacy_models).lower(),
                    },
                )
                # Reset the context var
                _legacy_models_used.reset(token)

        return wrapper

    return decorator
