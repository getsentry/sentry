"""
sentry.client.middleware
~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django.middleware.common import _is_ignorable_404
from sentry.client.models import get_client
import threading
import logging

class Sentry404CatchMiddleware(object):
    def process_response(self, request, response):
        if response.status_code != 404 or _is_ignorable_404(request.get_full_path()):
            return response
        message_id = get_client().create_from_text('Http 404', request=request, level=logging.INFO, logger='http404')
        request.sentry = {
            'id': message_id,
        }
        return response

    # sentry_exception_handler(sender=Sentry404CatchMiddleware, request=request)

class SentryResponseErrorIdMiddleware(object):
    """
    Appends the X-Sentry-ID response header for referencing a message within
    the Sentry datastore.
    """
    def process_response(self, request, response):
        if not getattr(request, 'sentry', None):
            return response
        response['X-Sentry-ID'] = request.sentry['id']
        return response

class SentryLogMiddleware(object):
    # Create a threadlocal variable to store the session in for logging
    thread = threading.local()

    def process_request(self, request):
        self.thread.request = request

