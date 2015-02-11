from __future__ import absolute_import

from sentry.web.frontend.base import OrganizationView
from sentry.utils.functional import extract_lazy_object


# TODO(dcramer): once we implement basic auth hooks in React we can make this
# generic
class ReactPageView(OrganizationView):
    def handle(self, request, **kwargs):
        if request.user.is_authenticated():
            # remove lazy eval
            request.user = extract_lazy_object(request.user)

        return self.respond('sentry/bases/react.html')
