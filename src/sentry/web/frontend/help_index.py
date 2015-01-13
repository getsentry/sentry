from __future__ import absolute_import, print_function

from sentry.web.frontend.base import BaseView


class HelpIndexView(BaseView):
    auth_required = False

    def get(self, request):
        return self.respond('sentry/help/index.html')
