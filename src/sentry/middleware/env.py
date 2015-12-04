from __future__ import absolute_import

from sentry.app import env


class SentryEnvMiddleware(object):
    def process_request(self, request):
        # bind request to env
        env.request = request
