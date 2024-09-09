from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from sentry.web.frontend.base import BaseView


class IframeView(BaseView):
    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        if self.is_auth_required(request, *args, **kwargs):
            self.default_context = self.get_context_data(request, *args, **kwargs)
            # TODO: might want to check the method or org here
            response = self.respond("sentry/toolbar/iframe-no-auth.html", status=401)
            response["X-Frame-Options"] = "ALLOWALL"
            return response

        return super().dispatch(request, *args, **kwargs)

    def get(self, request, organization_slug, project_slug):
        response = self.respond("sentry/toolbar/iframe.html")
        response["X-Frame-Options"] = "ALLOWALL"
        return response
