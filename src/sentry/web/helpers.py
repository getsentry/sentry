from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

from django.http import HttpRequest, HttpResponse
from django.middleware.csrf import get_token
from django.template import loader
from django.utils import timezone

from sentry.utils.dates import AVAILABLE_TIMEZONES

logger = logging.getLogger("sentry")


def render_to_string(
    template: Sequence[str] | str,
    context: Mapping[str, Any] | None = None,
    request: HttpRequest | None = None,
) -> str:
    if context is None:
        context = dict()
    else:
        context = dict(context)

    if "timezone" in context and context["timezone"] in AVAILABLE_TIMEZONES:
        timezone.activate(context["timezone"])

    rendered = loader.render_to_string(template, context=context, request=request)
    timezone.deactivate()

    return rendered


def render_to_response(
    template: Sequence[str] | str,
    context: Mapping[str, Any] | None = None,
    request: HttpRequest | None = None,
    status: int = 200,
    content_type: str = "text/html",
) -> HttpResponse:
    # Ensure CSRF token is generated and cookie is set
    if request is not None:
        get_token(request)

    response = HttpResponse(render_to_string(template, context, request))
    response.status_code = status
    response["Content-Type"] = content_type
    return response
