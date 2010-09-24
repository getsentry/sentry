from sentry.client.base import SentryClient
from sentry.client.celery import tasks

class CelerySentryClient(SentryClient):
    def send(self, **kwargs):
        "Errors through celery"
        tasks.send.delay(kwargs)