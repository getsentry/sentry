"""
sentry.tasks.store
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import logging

from raven.contrib.django.models import client as Raven
from time import time

from sentry.cache import default_cache
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.safe import safe_execute

error_logger = logging.getLogger('sentry.errors.events')


@instrumented_task(
    name='sentry.tasks.store.preprocess_event',
    queue='events.preprocess_event',
    time_limit=65,
    soft_time_limit=60,
)
def preprocess_event(cache_key=None, data=None, start_time=None, **kwargs):
    from sentry.plugins import plugins

    if cache_key:
        data = default_cache.get(cache_key)

    if data is None:
        metrics.incr('events.failed', tags={'reason': 'cache', 'stage': 'pre'})
        error_logger.error('preprocess.failed.empty', extra={'cache_key': cache_key})
        return

    project = data['project']
    Raven.tags_context({
        'project': project,
    })

    # Iterate over all plugins looking for processors based on the input data
    # plugins should yield a processor function only if it actually can operate
    # on the input data, otherwise it should yield nothing
    for plugin in plugins.all(version=2):
        processors = safe_execute(plugin.get_event_preprocessors, data=data, _with_transaction=False)
        for processor in (processors or ()):
            # On the first processor found, we just defer to the process_event
            # queue to handle the actual work.
            process_event.delay(cache_key=cache_key, start_time=start_time)
            return

    # If we get here, that means the event had no preprocessing needed to be done
    # so we can jump directly to save_event
    if cache_key:
        data = None
    save_event.delay(cache_key=cache_key, data=data, start_time=start_time)


@instrumented_task(
    name='sentry.tasks.store.process_event',
    queue='events.process_event',
    time_limit=65,
    soft_time_limit=60,
)
def process_event(cache_key, start_time=None, **kwargs):
    from sentry.plugins import plugins

    data = default_cache.get(cache_key)

    if data is None:
        metrics.incr('events.failed', tags={'reason': 'cache', 'stage': 'process'})
        error_logger.error('process.failed.empty', extra={'cache_key': cache_key})
        return

    project = data['project']
    Raven.tags_context({
        'project': project,
    })

    # TODO(dcramer): ideally we would know if data changed by default
    has_changed = False
    for plugin in plugins.all(version=2):
        processors = safe_execute(plugin.get_event_preprocessors, data=data, _with_transaction=False)
        for processor in (processors or ()):
            result = safe_execute(processor, data)
            if result:
                data = result
                has_changed = True

    assert data['project'] == project, 'Project cannot be mutated by preprocessor'

    if has_changed:
        default_cache.set(cache_key, data, 3600)

    save_event.delay(cache_key=cache_key, data=None, start_time=start_time)


@instrumented_task(
    name='sentry.tasks.store.save_event',
    queue='events.save_event')
def save_event(cache_key=None, data=None, start_time=None, **kwargs):
    """
    Saves an event to the database.
    """
    from sentry.event_manager import EventManager

    if cache_key:
        data = default_cache.get(cache_key)

    if data is None:
        metrics.incr('events.failed', tags={'reason': 'cache', 'stage': 'post'})
        return

    project = data.pop('project')
    Raven.tags_context({
        'project': project,
    })

    try:
        manager = EventManager(data)
        manager.save(project)
    finally:
        if cache_key:
            default_cache.delete(cache_key)
        if start_time:
            metrics.timing('events.time-to-process', time() - start_time,
                           instance=data['platform'])
