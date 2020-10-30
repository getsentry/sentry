from __future__ import absolute_import, print_function

import logging

from django.conf import settings
from django.http import HttpResponse

logger = logging.getLogger("sentry.errors")

DB_ERRORS = []

try:
    import psycopg2
except ImportError:
    pass
else:
    DB_ERRORS.append(psycopg2.OperationalError)

DB_ERRORS = tuple(DB_ERRORS)


class ServicesUnavailableMiddleware(object):
    def process_request(self, request):
        if settings.MAINTENANCE:
            return HttpResponse("Sentry is currently in maintenance mode", status=503)

    def process_exception(self, request, exception):
        if isinstance(exception, DB_ERRORS):
            logger.exception("Fatal error returned from database")
            return HttpResponse("Sentry is currently in maintenance mode", status=503)
