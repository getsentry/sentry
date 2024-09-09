from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from sentry.web.frontend.base import BaseView


class IframeView(BaseView):
    security_headers = {
        "X-Frame-Options": "ALLOWALL",
        # TODO: # Not working, seems to get overridden by a BaseView wrapper
        # "Content-Security-Policy": "frame-ancestors http://dev.getsentry.net/ http: https:",
    }

    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        if self.is_auth_required(request, *args, **kwargs):
            self.default_context = self.get_context_data(request, *args, **kwargs)
            # TODO: might want to check the method or org here
            response = self.respond("sentry/toolbar/iframe-no-auth.html", status=401)
            for header, val in IframeView.security_headers.items():
                response[header] = val
            return response

        return super().dispatch(request, *args, **kwargs)

    def get(self, request, organization_slug, project_slug):
        response = self.respond("sentry/toolbar/iframe.html")
        for header, val in IframeView.security_headers.items():
            response[header] = val
        return response
