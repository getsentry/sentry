from sentry.client.models import sentry_exception_handler

class Sentry404CatchMiddleware(object):
    def process_response(self, request, response):
        if response.status_code != 404:
            return
        sentry_exception_handler(sender=Sentry404CatchMiddleware, request=request)
