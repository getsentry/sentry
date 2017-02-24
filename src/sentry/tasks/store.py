"""
sentry.tasks.store
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import logging
from datetime import datetime

from raven.contrib.django.models import client as Raven
from time import time
from django.utils import timezone

from sentry.cache import default_cache
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.safe import safe_execute
from sentry.stacktraces import process_stacktraces, \
    should_process_for_stacktraces

error_logger = logging.getLogger('sentry.errors.events')


def should_process(data):
    """Quick check if processing is needed at all."""
    from sentry.plugins import plugins

    for plugin in plugins.all(version=2):
        processors = safe_execute(plugin.get_event_preprocessors, data=data,
                                  _with_transaction=False)
        if processors:
            return True

    if should_process_for_stacktraces(data):
        return True

    return False


def _do_preprocess_event(cache_key, data, start_time, event_id,
                         process_event):
    if cache_key:
        data = default_cache.get(cache_key)

    if data is None:
        metrics.incr('events.failed', tags={'reason': 'cache', 'stage': 'pre'})
        error_logger.error('preprocess.failed.empty',
            extra={'cache_key': cache_key})
        return

    project = data['project']
    Raven.tags_context({
        'project': project,
    })

    if should_process(data):
        process_event.delay(cache_key=cache_key, start_time=start_time,
            event_id=event_id)
        return

    # If we get here, that means the event had no preprocessing needed to be done
    # so we can jump directly to save_event
    if cache_key:
        data = None
    save_event.delay(cache_key=cache_key, data=data, start_time=start_time,
        event_id=event_id)


@instrumented_task(
    name='sentry.tasks.store.preprocess_event',
    queue='events.preprocess_event',
    time_limit=65,
    soft_time_limit=60,
)
def preprocess_event(cache_key=None, data=None, start_time=None, event_id=None, **kwargs):
    return _do_preprocess_event(cache_key, data, start_time, event_id,
                                process_event)


@instrumented_task(
    name='sentry.tasks.store.preprocess_event_from_reprocessing',
    queue='events.reprocessing.preprocess_event',
    time_limit=65,
    soft_time_limit=60,
)
def preprocess_event_from_reprocessing(cache_key=None, data=None,
                                       start_time=None, event_id=None, **kwargs):
    return _do_preprocess_event(cache_key, data, start_time, event_id,
                                process_event_from_reprocessing)


def _do_process_event(cache_key, start_time, event_id):
    from sentry.plugins import plugins

    data = default_cache.get(cache_key)

    if data is None:
        metrics.incr('events.failed', tags={'reason': 'cache', 'stage': 'process'})
        error_logger.error('process.failed.empty',
            extra={'cache_key': cache_key})
        return

    project = data['project']
    Raven.tags_context({
        'project': project,
    })
    has_changed = False

    # Stacktrace based event processors.  These run before anything else.
    new_data = process_stacktraces(data)
    if new_data is not None:
        has_changed = True
        data = new_data

    # TODO(dcramer): ideally we would know if data changed by default
    # Default event processors.
    for plugin in plugins.all(version=2):
        processors = safe_execute(plugin.get_event_preprocessors,
                                  data=data, _with_transaction=False)
        for processor in (processors or ()):
            result = safe_execute(processor, data)
            if result:
                data = result
                has_changed = True

    assert data['project'] == project, 'Project cannot be mutated by preprocessor'

    if has_changed:
        issues = data.get('processing_issues')
        if issues:
            create_failed_event(cache_key, project, list(issues.values()),
                event_id=event_id)
            return

        default_cache.set(cache_key, data, 3600)

    save_event.delay(cache_key=cache_key, data=None, start_time=start_time,
        event_id=event_id)


@instrumented_task(
    name='sentry.tasks.store.process_event',
    queue='events.process_event',
    time_limit=65,
    soft_time_limit=60,
)
def process_event(cache_key, start_time=None, event_id=None, **kwargs):
    return _do_process_event(cache_key, start_time, event_id)


@instrumented_task(
    name='sentry.tasks.store.process_event_from_reprocessing',
    queue='events.reprocessing.process_event',
    time_limit=65,
    soft_time_limit=60,
)
def process_event_from_reprocessing(cache_key, start_time=None, event_id=None, **kwargs):
    return _do_process_event(cache_key, start_time, event_id)


def delete_raw_event(project_id, event_id):
    if event_id is None:
        error_logger.error('process.failed_delete_raw_event',
            extra={'project_id': project_id})
        return
    from sentry.models import RawEvent, ReprocessingReport
    RawEvent.objects.filter(
        project_id=project_id,
        event_id=event_id
    ).delete()
    ReprocessingReport.objects.filter(
        project_id=project_id,
        event_id=event_id
    ).delete()


def create_failed_event(cache_key, project, issues, event_id):
    """If processing failed we put the original data from the cache into a
    raw event.
    """
    # We need to get the original data here instead of passing the data in
    # from the last processing step because we do not want any
    # modifications to take place.
    delete_raw_event(project, event_id)
    data = default_cache.get(cache_key)
    if data is None:
        metrics.incr('events.failed', tags={'reason': 'cache', 'stage': 'raw'})
        error_logger.error('process.failed_raw.empty', extra={'cache_key': cache_key})
        return

    from sentry.models import RawEvent, ProcessingIssue
    raw_event = RawEvent.objects.create(
        project_id=project,
        event_id=event_id,
        datetime=datetime.utcfromtimestamp(
            data['timestamp']).replace(tzinfo=timezone.utc),
        data=data
    )

    for issue in issues:
        ProcessingIssue.objects.record_processing_issue(
            raw_event=raw_event,
            scope=issue['scope'],
            object=issue['object'],
            type=issue['type'],
            data=issue['data'],
        )

    default_cache.delete(cache_key)


@instrumented_task(
    name='sentry.tasks.store.save_event',
    queue='events.save_event')
def save_event(cache_key=None, data=None, start_time=None, event_id=None, **kwargs):
    """
    Saves an event to the database.
    """
    from sentry.event_manager import EventManager

    if cache_key:
        data = default_cache.get(cache_key)

    if event_id is None and data is not None:
        event_id = data['event_id']

    if data is None:
        metrics.incr('events.failed', tags={'reason': 'cache', 'stage': 'post'})
        return

    project = data.pop('project')

    delete_raw_event(project, event_id)

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
