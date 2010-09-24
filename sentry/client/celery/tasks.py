from celery.decorators import task
from sentry.client.celery import settings

@task(routing_key=settings.CELERY_ROUTING_KEY)
def send(data):
    from sentry.models import GroupedMessage
    return GroupedMessage.objects.from_kwargs(**data)