from __future__ import absolute_import

from django.views.generic import View
from django.template import Context, loader
from django.http import HttpResponseNotFound


class Error404View(View):
    def dispatch(self, request):
        context = {
            'request': request,
        }

        t = loader.get_template('sentry/404.html')
        return HttpResponseNotFound(t.render(Context(context)))
