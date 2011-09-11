"""
sentry.client.celery.tasks
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from celery.decorators import task
from sentry.client.base import SentryClient
from sentry.client.celery import conf

@task(routing_key=conf.CELERY_ROUTING_KEY)
def send(data):
    return SentryClient().send(**data)
