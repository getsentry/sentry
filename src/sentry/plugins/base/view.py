from __future__ import annotations

from typing import Any

from django.http import HttpResponseRedirect

from sentry.plugins.base.response import DeferredResponse


class PluggableViewMixin:
    """
    A mix-in which provides a render method which returns a special object to
    enable embedding of content within base-views.
    """

    def redirect(self, url: str) -> HttpResponseRedirect:
        """
        Returns a redirect response type.
        """
        return HttpResponseRedirect(url)

    def render(self, template: str, context: dict[str, Any] | None = None) -> DeferredResponse:
        """
        Given a template name, and an optional context (dictionary), returns a
        ready-to-render response.

        Default context includes the plugin instance.

        >>> self.render('template.html', {'hello': 'world'})
        """
        if context is None:
            context = {}
        context["plugin"] = self
        return DeferredResponse(template, context)


__all__ = ["PluggableViewMixin"]
