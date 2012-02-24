from sentry.conf import settings
from django.core.urlresolvers import reverse


class SentryMiddleware(object):
    def process_request(self, request):
        # HACK: bootstrap some env crud if we havent yet
        if not settings.URL_PREFIX:
            settings.URL_PREFIX = request.build_absolute_uri(reverse('sentry')).strip('/')


