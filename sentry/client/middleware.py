from sentry.client.models import sentry_exception_handler

class Sentry404CatchMiddleware(object):
    def process_response(self, request, response):
        if response.status_code != 404:
            return
        sentry_exception_handler(sender=Sentry404CatchMiddleware, request=request)

class SentryResponseErrorIdMiddleware(object):
    """
    Appends the X-Sentry-ID response header for referencing a message within
    the Sentry datastore.
    """
    def process_response(self, request, response):
        if not getattr(request, 'sentry', None):
            return
        response['X-Sentry-ID'] = request.sentry['id']
        return response
