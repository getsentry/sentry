from __future__ import absolute_import

from django.http import HttpResponse
from django.template import loader

from sentry.web.frontend.base import BaseView, OrganizationView


class ReactMixin(object):
    def handle_react(self, request):
        template = loader.render_to_string('sentry/bases/react.html')

        response = HttpResponse(template)
        response['Content-Type'] = 'text/html'

        return response


# TODO(dcramer): once we implement basic auth hooks in React we can make this
# generic
class ReactPageView(OrganizationView, ReactMixin):
    def handle(self, request, **kwargs):
        return self.handle_react(request)


class GenericReactPageView(BaseView, ReactMixin):
    def handle(self, request, **kwargs):
        return self.handle_react(request)
