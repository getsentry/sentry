from __future__ import absolute_import

from django.conf import settings
from django.core.urlresolvers import reverse

from sentry.app import env


class SentryEnvMiddleware(object):
    def process_request(self, request):
        # HACK: bootstrap some env crud if we haven't yet
        if not settings.SENTRY_URL_PREFIX:
            settings.SENTRY_URL_PREFIX = request.build_absolute_uri(reverse('sentry')).strip('/')

        # bind request to env
        env.request = request
