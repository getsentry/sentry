from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from sentry.web.frontend.base import BaseView


class IframeView(BaseView):
    @method_decorator(csrf_exempt)
    def get(self, request, organization_slug):
        response = self.respond("sentry/toolbar/iframe.html")
        response["X-Frame-Options"] = "ALLOWALL"
        return response
