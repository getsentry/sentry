"""
sentry.middleware.maintenance
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from django.conf import settings
from django.http import HttpResponse


class ServicesUnavailableMiddleware(object):
    def __init__(self):
        # Bail out early and disable this middleware entirely
        if not settings.MAINTENANCE:
            from django.core.exceptions import MiddlewareNotUsed
            raise MiddlewareNotUsed

    def process_request(self, request):
        return HttpResponse('Sentry is currently in maintenance mode', status=503)
