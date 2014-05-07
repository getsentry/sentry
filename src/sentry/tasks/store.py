"""
sentry.tasks.store
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.conf import settings
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name='sentry.tasks.store.preprocess_event',
    queue='events')
def preprocess_event(data, **kwargs):
    from sentry.tasks.fetch_source import expand_javascript_source

    logger = preprocess_event.get_logger()

    try:
        if settings.SENTRY_SCRAPE_JAVASCRIPT_CONTEXT and data['platform'] == 'javascript':
            try:
                expand_javascript_source(data)
            except Exception as e:
                logger.exception(u'Error fetching javascript source: %r [%s]', data['event_id'], e)
    finally:
        save_event.delay(data=data)


@instrumented_task(
    name='sentry.tasks.store.save_event',
    queue='events')
def save_event(data, **kwargs):
    """
    Saves an event to the database.
    """
    from sentry.models import Group

    Group.objects.save_data(data.pop('project'), data)


@instrumented_task(
    name='sentry.tasks.store.store_event',
    queue='events')
def store_event(data, **kwargs):
    """
    Saves an event to the database.

    Deprecated.
    """
    preprocess_event.delay(data=data)
