from __future__ import absolute_import

from sentry.auth.utils import is_active_superuser


class SuperuserMiddleware(object):
    def process_request(self, request):
        request.is_superuser = lambda: is_active_superuser(request)
