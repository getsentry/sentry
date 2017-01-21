from __future__ import absolute_import

from django.core.signals import request_finished

from sentry.app import env


class SentryEnvMiddleware(object):
    def process_request(self, request):
        # bind request to env
        env.request = request


def clear_request(**kwargs):
    env.request = None

request_finished.connect(clear_request)
