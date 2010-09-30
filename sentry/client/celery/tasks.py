from celery.decorators import task
from sentry.client.base import SentryClient
from sentry.client.celery import conf

@task(routing_key=conf.CELERY_ROUTING_KEY)
def send(data):
    return SentryClient().send(**data)
