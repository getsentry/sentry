from __future__ import annotations

import logging
from typing import Any, Mapping

import pytz
from django.http import HttpRequest, HttpResponse
from django.template import loader
from django.utils import timezone

from sentry.utils.auth import get_login_url  # NOQA: backwards compatibility

logger = logging.getLogger("sentry")


def render_to_string(
    template: str, context: Mapping[str, Any] | None = None, request: HttpRequest | None = None
) -> str:
    if context is None:
        context = dict()
    else:
        context = dict(context)

    if "timezone" in context and context["timezone"] in pytz.all_timezones_set:
        timezone.activate(context["timezone"])

    rendered = loader.render_to_string(template, context=context, request=request)
    timezone.deactivate()

    return rendered  # type: ignore[no-any-return]


def render_to_response(
    template: str,
    context: Mapping[str, Any] | None = None,
    request: HttpRequest | None = None,
    status: int = 200,
    content_type: str = "text/html",
) -> HttpResponse:
    response = HttpResponse(render_to_string(template, context, request))
    response.status_code = status
    response["Content-Type"] = content_type
    return response
