from __future__ import absolute_import

import inspect
import six
import time

from django.http import Http404

from sentry.utils import metrics


class ResponseCodeMiddleware(object):
    def process_response(self, request, response):
        metrics.incr('response', instance=six.text_type(response.status_code))
        return response

    def process_exception(self, request, exception):
        if not isinstance(exception, Http404):
            metrics.incr('response', instance='500')


class RequestTimingMiddleware(object):
    allowed_methods = ('POST', 'GET')
    allowed_paths = (
        'sentry.web.api.StoreView',
        'sentry.api.endpoints',
    )

    def process_view(self, request, view_func, view_args, view_kwargs):
        if request.method not in self.allowed_methods:
            return

        view = view_func
        if not inspect.isfunction(view_func):
            view = view.__class__

        try:
            path = '%s.%s' % (view.__module__, view.__name__)
        except AttributeError:
            return

        if not path.startswith(self.allowed_paths):
            return

        request._view_path = path
        request._start_time = time.time()

    def process_response(self, request, response):
        self._record_time(request, response.status_code)
        return response

    def process_exception(self, request, exception):
        self._record_time(request, 500)

    def _record_time(self, request, status_code):
        if not hasattr(request, '_view_path'):
            return

        metrics.incr('view.response', instance=request._view_path, tags={
            'method': request.method,
            'status_code': status_code,
        })

        if not hasattr(request, '_start_time'):
            return

        ms = int((time.time() - request._start_time) * 1000)
        metrics.timing('view.duration', ms, instance=request._view_path, tags={
            'method': request.method,
        })
