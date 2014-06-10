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
def preprocess_event(cache_key=None, data=None, **kwargs):
    from sentry.app import cache
    from sentry.tasks.fetch_source import expand_javascript_source

    if cache_key:
        data = cache.get(cache_key)

    if data is None:
        return

    logger = preprocess_event.get_logger()

    try:
        if settings.SENTRY_SCRAPE_JAVASCRIPT_CONTEXT and data['platform'] == 'javascript':
            try:
                expand_javascript_source(data)
            except Exception as e:
                logger.exception(u'Error fetching javascript source: %r [%s]', data['event_id'], e)
            else:
                cache.set(cache_key, data, 3600)
    finally:
        if cache_key:
            data = None
        save_event.delay(cache_key=cache_key, data=data)


@instrumented_task(
    name='sentry.tasks.store.save_event',
    queue='events')
def save_event(cache_key=None, data=None, **kwargs):
    """
    Saves an event to the database.
    """
    from sentry.app import cache
    from sentry.models import Group

    if cache_key:
        data = cache.get(cache_key)

    if data is None:
        return

    try:
        Group.objects.save_data(data.pop('project'), data)
    finally:
        if cache_key:
            cache.delete(cache_key)
