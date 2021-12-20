from django.core.signals import request_finished
from django.utils.deprecation import MiddlewareMixin
from rest_framework.request import Request

from sentry.app import env


class SentryEnvMiddleware(MiddlewareMixin):
    def process_request(self, request: Request):
        # bind request to env
        env.request = request


def clear_request(**kwargs):
    env.request = None


request_finished.connect(clear_request)
