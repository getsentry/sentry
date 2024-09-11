from typing import Any

from django.http import HttpRequest, HttpResponse

from sentry.web.frontend.base import OrganizationView, region_silo_view


@region_silo_view
class IframeView(OrganizationView):
    # TODO: For perms check. This is just an example and we might not need it.
    # required_scope = "org:read,org:integrations"

    security_headers = {"X-Frame-Options": "ALLOWALL"}

    def respond(self, template: str, context: dict[str, Any] | None = None, status: int = 200):
        response = super().respond(template, context=context, status=status)
        for header, val in IframeView.security_headers.items():
            response[header] = val
        return response

    def handle_auth_required(self, request: HttpRequest, *args, **kwargs):
        # Override redirects to login
        if request.method == "GET":
            self.default_context = {}
            return self.respond("sentry/toolbar/iframe.html", status=401)
        return HttpResponse(status=401)

    def handle_permission_required(self, request: HttpRequest, *args, **kwargs):
        # Override redirects to login
        if request.method == "GET":
            self.default_context = {}
            return self.respond("sentry/toolbar/iframe.html", status=403)
        return HttpResponse(status=403)

    def get(self, request: HttpRequest, organization, project_id_or_slug):
        return self.respond("sentry/toolbar/iframe.html", status=200)
