"""
sentry.plugins.base.response
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

__all__ = ('Response',)

from django.core.context_processors import csrf
from django.http import HttpResponse


class Response(object):
    def __init__(self, template, context=None):
        self.template = template
        self.context = context

    def respond(self, request, context=None):
        return HttpResponse(self.render(request, context))

    def render(self, request, context=None):
        from sentry.web.helpers import render_to_string

        if not context:
            context = {}

        if self.context:
            context.update(self.context)

        context.update(csrf(request))

        return render_to_string(self.template, context, request)
