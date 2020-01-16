from __future__ import absolute_import

from django.views.generic import View

from sentry.web.helpers import render_to_response


class Error404View(View):
    def dispatch(self, request):
        return render_to_response("sentry/404.html", status=404, request=request)
