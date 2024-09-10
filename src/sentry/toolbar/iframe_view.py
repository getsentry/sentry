from typing import Any

from django.http import HttpRequest

from sentry.web.frontend.base import ProjectView, region_silo_view


@region_silo_view
class IframeView(ProjectView):
    # required_scope = "project:read"  # TODO:

    security_headers = {
        "X-Frame-Options": "ALLOWALL",
        # TODO: # Not working, seems to get overridden by a BaseView wrapper
        # "Content-Security-Policy": "frame-ancestors http://dev.getsentry.net/ http: https:",
    }

    def respond(self, template: str, context: dict[str, Any] | None = None, status: int = 200):
        response = super().respond(template, context=context, status=status)
        for header, val in IframeView.security_headers.items():
            response[header] = val
        return response

    def handle_auth_required(self, request: HttpRequest, *args, **kwargs):
        # Override redirects to login
        self.default_context = {}
        return self.respond("sentry/toolbar/iframe-no-auth.html", status=401)

    def handle_permission_required(self, request: HttpRequest, *args, **kwargs):
        # Override redirects to login
        self.default_context = {}
        return self.respond("sentry/toolbar/iframe-no-auth.html", status=403)

    def get(self, request: HttpRequest, organization, project):
        return self.respond("sentry/toolbar/iframe.html", status=200)
