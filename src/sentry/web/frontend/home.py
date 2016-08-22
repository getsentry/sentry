from __future__ import absolute_import

from sentry.web.frontend.base import BaseView


class HomeView(BaseView):
    def get(self, request):
        return self.redirect_to_org(request)
