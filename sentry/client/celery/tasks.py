from celery.decorators import task
from sentry.client.base import SentryClient
from sentry.client.celery import settings

@task(routing_key=settings.CELERY_ROUTING_KEY)
def send(data):
    return SentryClient().send(**data)
