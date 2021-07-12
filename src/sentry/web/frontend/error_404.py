from django.views.generic import View

from sentry.web.helpers import render_to_response


class Error404View(View):
    def dispatch(self, request, exception=None):
        # HACK: We don't have any use for exception, but in Django 2.0,
        #       signatures for 4XX handler views were changed to include it.
        return render_to_response("sentry/404.html", status=404, request=request)
