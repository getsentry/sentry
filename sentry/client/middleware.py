from django.http import Http404

from sentry.client.models import sentry_exception_handler

# XXX: this isnt working

class Sentry404CatchMiddleware(object):
    def process_exception(self, request, exception):
        if not isinstance(exception, Http404):
            return
        sentry_exception_handler(sender=Sentry404CatchMiddleware, request=request)
    