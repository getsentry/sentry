"""
sentry.tasks.store
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.conf import settings

from sentry.tasks.base import instrumented_task
from sentry.utils.safe import safe_execute


@instrumented_task(
    name='sentry.tasks.store.preprocess_event',
    queue='events')
def preprocess_event(cache_key=None, data=None, **kwargs):
    from sentry.app import cache
    from sentry.plugins import plugins
    from sentry.tasks.fetch_source import expand_javascript_source

    if cache_key:
        data = cache.get(cache_key)

    logger = preprocess_event.get_logger()

    if data is None:
        logger.error('Data not available in preprocess_event (cache_key=%s)', cache_key)
        return

    project = data['project']

    # TODO(dcramer): ideally we would know if data changed by default
    has_changed = False

    # TODO(dcramer): move js sourcemap processing into JS plugin
    if settings.SENTRY_SCRAPE_JAVASCRIPT_CONTEXT and data.get('platform') == 'javascript':
        try:
            expand_javascript_source(data)
        except Exception as e:
            logger.exception(u'Error fetching javascript source: %r [%s]', data['event_id'], e)
        else:
            has_changed = True

    for plugin in plugins.all(version=2):
        for processor in (safe_execute(plugin.get_event_preprocessors) or ()):
            result = safe_execute(processor, data)
            if result:
                data = result
                has_changed = True

    assert data['project'] == project, 'Project cannot be mutated by preprocessor'

    if has_changed and cache_key:
        cache.set(cache_key, data, 3600)

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
    from sentry.event_manager import EventManager

    if cache_key:
        data = cache.get(cache_key)

    if data is None:
        return

    project = data.pop('project')

    try:
        manager = EventManager(data)
        manager.save(project)
    finally:
        if cache_key:
            cache.delete(cache_key)
