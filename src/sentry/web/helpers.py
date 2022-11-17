from __future__ import annotations

import logging
from typing import Any, Mapping

import pytz
from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.template import loader
from django.utils import timezone

from sentry.models import Team
from sentry.utils.auth import get_login_url  # NOQA: backwards compatibility
from sentry.utils.settings import is_self_hosted

logger = logging.getLogger("sentry")


def get_default_context(
    request: HttpRequest,
    existing_context: Mapping[str, Any] | None = None,
    team: Team | None = None,
) -> dict[str, Any]:
    from sentry import options
    from sentry.plugins.base import plugins

    context = {
        "URL_PREFIX": options.get("system.url-prefix"),
        "SINGLE_ORGANIZATION": settings.SENTRY_SINGLE_ORGANIZATION,
        "PLUGINS": plugins,
        # Maintain ONPREMISE key for backcompat (plugins?). TBH context could
        # probably be removed entirely: github.com/getsentry/sentry/pull/30970.
        "ONPREMISE": is_self_hosted(),
        "SELF_HOSTED": is_self_hosted(),
    }

    return context


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
