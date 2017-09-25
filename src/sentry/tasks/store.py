"""
sentry.tasks.store
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import six
import logging
from datetime import datetime

from raven.contrib.django.models import client as Raven
from time import time
from django.utils import timezone

from sentry.cache import default_cache
from sentry.filters.preprocess_hashes import get_raw_cache_key, hash_cache
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.safe import safe_execute
from sentry.stacktraces import process_stacktraces, \
    should_process_for_stacktraces
from sentry.utils.dates import to_datetime
from sentry.models import ProjectOption, Activity, Project

error_logger = logging.getLogger('sentry.errors.events')
info_logger = logging.getLogger('sentry.store')

# Is reprocessing on or off by default?
REPROCESSING_DEFAULT = False


def should_process(data):
    """Quick check if processing is needed at all."""
    from sentry.plugins import plugins

    for plugin in plugins.all(version=2):
        processors = safe_execute(
            plugin.get_event_preprocessors, data=data, _with_transaction=False
        )
        if processors:
            return True

    if should_process_for_stacktraces(data):
        return True

    return False


def _do_preprocess_event(cache_key, data, start_time, event_id, process_event):
    if cache_key:
        data = default_cache.get(cache_key)

    if data is None:
        metrics.incr('events.failed', tags={'reason': 'cache', 'stage': 'pre'})
        error_logger.error('preprocess.failed.empty', extra={'cache_key': cache_key})
        return

    project_id = data['project']
    Raven.tags_context({
        'project': project_id,
    })

    if should_process(data):
        # save another version of data for some projects to generate
        # preprocessing hash that won't be modified by pipeline
        try:
            hash_cache.set(get_raw_cache_key(project_id, data['event_id']), data)
        except Exception as e:
            error_logger.exception(
                'Could not save raw event for preprocess hash '
                'generation due to error: %s' % six.text_type(e)
            )

        process_event.delay(cache_key=cache_key, start_time=start_time, event_id=event_id)
        return

    # If we get here, that means the event had no preprocessing needed to be done
    # so we can jump directly to save_event
    if cache_key:
        data = None
    save_event.delay(cache_key=cache_key, data=data, start_time=start_time, event_id=event_id)


@instrumented_task(
    name='sentry.tasks.store.preprocess_event',
    queue='events.preprocess_event',
    time_limit=65,
    soft_time_limit=60,
)
def preprocess_event(cache_key=None, data=None, start_time=None, event_id=None, **kwargs):
    return _do_preprocess_event(cache_key, data, start_time, event_id, process_event)


@instrumented_task(
    name='sentry.tasks.store.preprocess_event_from_reprocessing',
    queue='events.reprocessing.preprocess_event',
    time_limit=65,
    soft_time_limit=60,
)
def preprocess_event_from_reprocessing(
    cache_key=None, data=None, start_time=None, event_id=None, **kwargs
):
    return _do_preprocess_event(
        cache_key, data, start_time, event_id, process_event_from_reprocessing
    )


def _do_process_event(cache_key, start_time, event_id):
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
    has_changed = False

    # Stacktrace based event processors.  These run before anything else.
    new_data = process_stacktraces(data)
    if new_data is not None:
        has_changed = True
        data = new_data

    # TODO(dcramer): ideally we would know if data changed by default
    # Default event processors.
    for plugin in plugins.all(version=2):
        processors = safe_execute(
            plugin.get_event_preprocessors, data=data, _with_transaction=False
        )
        for processor in (processors or ()):
            result = safe_execute(processor, data)
            if result:
                data = result
                has_changed = True

    assert data['project'] == project, 'Project cannot be mutated by preprocessor'

    if has_changed:
        issues = data.get('processing_issues')
        if issues and create_failed_event(
            cache_key, project, list(issues.values()), event_id=event_id, start_time=start_time
        ):
            return

        default_cache.set(cache_key, data, 3600)

    save_event.delay(cache_key=cache_key, data=None, start_time=start_time, event_id=event_id)


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


def delete_raw_event(project_id, event_id, allow_hint_clear=False):
    if event_id is None:
        error_logger.error('process.failed_delete_raw_event', extra={'project_id': project_id})
        return
    from sentry.models import RawEvent, ReprocessingReport
    RawEvent.objects.filter(project_id=project_id, event_id=event_id).delete()
    ReprocessingReport.objects.filter(project_id=project_id, event_id=event_id).delete()

    # Clear the sent notification if we reprocessed everything
    # successfully and reprocessing is enabled
    reprocessing_active = ProjectOption.objects.get_value(
        project_id, 'sentry:reprocessing_active', REPROCESSING_DEFAULT
    )
    if reprocessing_active:
        sent_notification = ProjectOption.objects.get_value(
            project_id, 'sentry:sent_failed_event_hint', False
        )
        if sent_notification:
            if ReprocessingReport.objects.filter(
                    project_id=project_id, event_id=event_id).exists():
                project = Project.objects.get_from_cache(id=project_id)
                ProjectOption.objects.set_value(project, 'sentry:sent_failed_event_hint', False)


def create_failed_event(cache_key, project_id, issues, event_id, start_time=None):
    """If processing failed we put the original data from the cache into a
    raw event.  Returns `True` if a failed event was inserted
    """
    reprocessing_active = ProjectOption.objects.get_value(
        project_id, 'sentry:reprocessing_active', REPROCESSING_DEFAULT
    )

    # The first time we encounter a failed event and the hint was cleared
    # we send a notification.
    sent_notification = ProjectOption.objects.get_value(
        project_id, 'sentry:sent_failed_event_hint', False
    )
    if not sent_notification:
        project = Project.objects.get_from_cache(id=project_id)
        Activity.objects.create(
            type=Activity.NEW_PROCESSING_ISSUES,
            project=project,
            datetime=to_datetime(start_time),
            data={'reprocessing_active': reprocessing_active,
                  'issues': issues},
        ).send_notification()
        ProjectOption.objects.set_value(project, 'sentry:sent_failed_event_hint', True)

    # If reprocessing is not active we bail now without creating the
    # processing issues
    if not reprocessing_active:
        return False

    # We need to get the original data here instead of passing the data in
    # from the last processing step because we do not want any
    # modifications to take place.
    delete_raw_event(project_id, event_id)
    data = default_cache.get(cache_key)
    if data is None:
        metrics.incr('events.failed', tags={'reason': 'cache', 'stage': 'raw'})
        error_logger.error('process.failed_raw.empty', extra={'cache_key': cache_key})
        return True

    from sentry.models import RawEvent, ProcessingIssue
    raw_event = RawEvent.objects.create(
        project_id=project_id,
        event_id=event_id,
        datetime=datetime.utcfromtimestamp(data['timestamp']).replace(tzinfo=timezone.utc),
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

    return True


@instrumented_task(name='sentry.tasks.store.save_event', queue='events.save_event')
def save_event(cache_key=None, data=None, start_time=None, event_id=None, **kwargs):
    """
    Saves an event to the database.
    """
    from sentry.event_manager import HashDiscarded, EventManager

    if cache_key:
        data = default_cache.get(cache_key)

    if event_id is None and data is not None:
        event_id = data['event_id']

    if data is None:
        metrics.incr('events.failed', tags={'reason': 'cache', 'stage': 'post'})
        return

    project = data.pop('project')

    delete_raw_event(project, event_id, allow_hint_clear=True)

    Raven.tags_context({
        'project': project,
    })

    try:
        manager = EventManager(data)
        manager.save(project)
    except HashDiscarded as exc:
        # TODO(jess): remove this before it goes out to a wider audience
        info_logger.info(
            'discarded.hash', extra={
                'project_id': project,
                'description': exc.message,
            }
        )
    finally:
        if cache_key:
            default_cache.delete(cache_key)
        if start_time:
            metrics.timing(
                'events.time-to-process',
                time() - start_time,
                instance=data['platform'])
