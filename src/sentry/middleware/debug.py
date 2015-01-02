"""
sentry.middleware.debug
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from django.conf import settings


class NoIfModifiedSinceMiddleware(object):
    def __init__(self):
        if not settings.DEBUG:
            from django.core.exceptions import MiddlewareNotUsed
            raise MiddlewareNotUsed

    def process_request(self, request):
        request.META.pop('HTTP_IF_MODIFIED_SINCE', None)
