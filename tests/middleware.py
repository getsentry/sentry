from __future__ import absolute_import

from sentry.middleware.sudo import SudoMiddleware as BaseSudoMiddleware


class BrokenRequestMiddleware(object):
    def process_request(self, request):
        raise ImportError('request')


class BrokenResponseMiddleware(object):
    def process_response(self, request, response):
        raise ImportError('response')


class BrokenViewMiddleware(object):
    def process_view(self, request, func, args, kwargs):
        raise ImportError('view')


class SudoMiddleware(BaseSudoMiddleware):
    def has_sudo_privileges(self, request):
        return True
