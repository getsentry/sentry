from __future__ import absolute_import, print_function

from django.views.generic import View

from sentry.web.helpers import render_to_response


class HelpPlatformIndexView(View):

    def get(self, request):
        return render_to_response('sentry/help/platform_index.html', {}, request)
