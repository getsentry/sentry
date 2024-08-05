from __future__ import annotations

from typing import Any

from django.http import HttpRequest, HttpResponse
from django.template.context_processors import csrf

from sentry.web.helpers import render_to_string

__all__ = ("DeferredResponse",)


class DeferredResponse:
    def __init__(self, template: str, context: dict[str, Any] | None = None) -> None:
        self.template = template
        self.context = context

    def respond(self, request: HttpRequest, context: dict[str, Any] | None = None) -> HttpResponse:
        return HttpResponse(self.render(request, context))

    def render(self, request: HttpRequest, context: dict[str, Any] | None = None) -> str:
        if not context:
            context = {}

        if self.context:
            context.update(self.context)

        context.update(csrf(request))

        return render_to_string(self.template, context, request)
