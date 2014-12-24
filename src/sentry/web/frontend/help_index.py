from __future__ import absolute_import, print_function

from django.views.generic import View

from sentry.web.helpers import render_to_response


class HelpIndexView(View):

    def get(self, request):
        return render_to_response('sentry/help/index.html', {}, request)
