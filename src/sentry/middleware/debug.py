"""
sentry.middleware.debug
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.conf import settings


class NoIfModifiedSinceMiddleware(object):
    def process_request(self, request):
        if settings.DEBUG:
            request.META.pop('HTTP_IF_MODIFIED_SINCE', None)
