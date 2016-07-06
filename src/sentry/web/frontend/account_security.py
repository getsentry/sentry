from __future__ import absolute_import

from sentry.web.frontend.base import BaseView


class AccountSecurityView(BaseView):
    def handle(self, request):
        return self.respond('sentry/account/security.html', {
            'page': 'security',
        })
