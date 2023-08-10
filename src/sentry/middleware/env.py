from django.core.signals import request_finished
from django.utils.deprecation import MiddlewareMixin
from rest_framework.request import Request

from sentry.app import env


# In test environments, we sometimes run requests inline with other requests, so we're forced to maintain the full
# stack of requests happening inside of a process.  This does not normally happen in production however.
class SentryEnvMiddleware(MiddlewareMixin):
    def process_request(self, request: Request):
        # bind request to env
        if env.request_stack is None:
            env.request_stack = []
        if env.request:
            env.request_stack.append(env.request)
        env.request = request


def clear_request(**kwargs):
    if env.request_stack:
        env.request = env.request_stack.pop()
    else:
        env.request = None


request_finished.connect(clear_request)
