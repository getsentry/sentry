from __future__ import absolute_import

from django.core.context_processors import csrf
from django.http import HttpResponse
from django.template import loader, Context

from sentry.web.frontend.base import BaseView, OrganizationView


class ReactMixin(object):
    def handle_react(self, request):
        context = Context({'request': request})
        context.update(csrf(request))

        template = loader.render_to_string('sentry/bases/react.html', context)

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
