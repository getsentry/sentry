from __future__ import absolute_import

from celery.signals import task_postrun
from django.core.signals import request_finished

from sentry.app import env


class SentryEnvMiddleware(object):
    def process_request(self, request):
        # bind request to env
        env.request = request
        env.tenant = None


def clear_request(**kwargs):
    env.request = None
    env.tenant = None

request_finished.connect(clear_request)
task_postrun.connect(clear_request)
