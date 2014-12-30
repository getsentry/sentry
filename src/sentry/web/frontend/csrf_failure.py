from __future__ import absolute_import

from django.middleware.csrf import REASON_NO_REFERER

from sentry.web.frontend.base import BaseView


class CsrfFailureView(BaseView):
    auth_required = False
    sudo_required = False

    def handle(self, request, reason=""):
        context = {
            'no_referer': reason == REASON_NO_REFERER
        }

        return self.respond('sentry/403-csrf-failure.html', status=403)


view = CsrfFailureView.as_view()
