from typing import Any

from django.http import HttpRequest, HttpResponse

from sentry.web.frontend.base import BaseView, cell_silo_view

TEMPLATE = "sentry/toolbar/iframe.html"


@cell_silo_view
class IframeView(BaseView):
    """
    Existing sites still load the toolbar client from the CDN, and that client
    shows "Connecting..." forever unless this iframe posts a state message.
    Reporting `logged-out` gets it to render a Login button, which opens a
    page saying the toolbar is no longer available.
    """

    auth_required = False

    def get(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:
        # 1 R is because of legacy http reasons: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referer
        referrer = request.META.get("HTTP_REFERER") or ""

        response = self.respond(
            TEMPLATE,
            status=200,  # always return 200 so the html will render inside the iframe
            context={"referrer": referrer},
        )

        # No origin allowlist: the page holds no credentials and proxies no
        # requests, so any site that still embeds the toolbar may frame it.
        response._csp_replace = {"frame-ancestors": [referrer.strip("/") or "'none'"]}
        response["X-Frame-Options"] = "DENY" if referrer == "" else "ALLOWALL"

        return response
