"""
sentry.tasks.store
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from celery.task import task
from sentry.conf import settings


@task(name='sentry.tasks.store.preprocess_event', queue='events')
def preprocess_event(data, **kwargs):
    from sentry.models import Group
    from sentry.tasks.fetch_source import expand_javascript_source
    from sentry.utils.queue import maybe_delay

    logger = preprocess_event.get_logger()

    data = Group.objects.normalize_event_data(data)

    try:
        if settings.SCRAPE_JAVASCRIPT_CONTEXT and data['platform'] == 'javascript':
            try:
                expand_javascript_source(data)
            except Exception, e:
                logger.exception(u'Error fetching javascript source: %s', e)
    finally:
        maybe_delay(save_event, data=data)


@task(name='sentry.tasks.store.save_event', queue='events')
def save_event(data, **kwargs):
    """
    Saves an event to the database.
    """
    from sentry.models import Group

    Group.objects.save_data(data.pop('project'), data)


@task(name='sentry.tasks.store.store_event', queue='events')
def store_event(data, **kwargs):
    """
    Saves an event to the database.

    Deprecated.
    """
    from sentry.utils.queue import maybe_delay

    maybe_delay(preprocess_event, data=data)
