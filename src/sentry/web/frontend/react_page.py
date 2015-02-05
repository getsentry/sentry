from __future__ import absolute_import

from sentry.web.frontend.base import OrganizationView


# TODO(dcramer): once we implement basic auth hooks in React we can make this
# generic
class ReactPageView(OrganizationView):
    def handle(self, request, **kwargs):
        if request.user.is_authenticated():
            # remove lazy eval
            request.user = request.user._wrapped

        return self.respond('sentry/bases/react.html')
