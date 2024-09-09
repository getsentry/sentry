from sentry.web.frontend.base import BaseView


class IframeView(BaseView):
    def get(self, request, organization_slug):
        response = self.respond("sentry/toolbar/iframe.html")
        response["X-Frame-Options"] = "ALLOWALL"
        return response
