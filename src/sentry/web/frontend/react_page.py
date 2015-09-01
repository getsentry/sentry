from __future__ import absolute_import

from sentry.web.frontend.base import BaseView, OrganizationView


class ReactMixin(object):
    def handle_react(self, request):
        return self.respond('sentry/bases/react.html')


# TODO(dcramer): once we implement basic auth hooks in React we can make this
# generic
class ReactPageView(OrganizationView, ReactMixin):
    def handle(self, request, **kwargs):
        return self.handle_react(request)


class GenericReactPageView(BaseView, ReactMixin):
    def handle(self, request, **kwargs):
        return self.handle_react(request)
