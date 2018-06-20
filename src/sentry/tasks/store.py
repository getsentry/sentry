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

from sentry import reprocessing
from sentry.cache import default_cache
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.safe import safe_execute
from sentry.stacktraces import process_stacktraces, \
    should_process_for_stacktraces
from sentry.utils.canonical import CanonicalKeyDict
from sentry.utils.dates import to_datetime
from sentry.models import ProjectOption, Activity, Project

error_logger = logging.getLogger('sentry.errors.events')
info_logger = logging.getLogger('sentry.store')

# Is reprocessing on or off by default?
REPROCESSING_DEFAULT = False


class RetryProcessing(Exception):
    pass


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

    data = CanonicalKeyDict(data)
    project = data['project']
    Raven.tags_context({
        'project': project,
    })

    if should_process(data):
        process_event.delay(cache_key=cache_key, start_time=start_time, event_id=event_id)
        return

    # If we get here, that means the event had no preprocessing needed to be done
    # so we can jump directly to save_event
    if cache_key:
        data = None
    save_event.delay(
        cache_key=cache_key, data=data, start_time=start_time, event_id=event_id,
        project_id=project
    )


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


def _do_process_event(cache_key, start_time, event_id, process_task):
    from sentry.plugins import plugins

    data = default_cache.get(cache_key)

    if data is None:
        metrics.incr('events.failed', tags={'reason': 'cache', 'stage': 'process'})
        error_logger.error('process.failed.empty', extra={'cache_key': cache_key})
        return

    data = CanonicalKeyDict(data)
    project = data['project']
    Raven.tags_context({
        'project': project,
    })
    has_changed = False

    # Fetch the reprocessing revision
    reprocessing_rev = reprocessing.get_reprocessing_revision(project)

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
        try:
            if issues and create_failed_event(
                cache_key, project, list(issues.values()),
                event_id=event_id, start_time=start_time,
                reprocessing_rev=reprocessing_rev
            ):
                return
        except RetryProcessing:
            # If `create_failed_event` indicates that we need to retry we
            # invoke outselves again.  This happens when the reprocessing
            # revision changed while we were processing.
            process_task.delay(cache_key, start_time=start_time,
                               event_id=event_id)
            return

        default_cache.set(cache_key, data, 3600)

    save_event.delay(
        cache_key=cache_key, data=None, start_time=start_time, event_id=event_id,
        project_id=project
    )


@instrumented_task(
    name='sentry.tasks.store.process_event',
    queue='events.process_event',
    time_limit=65,
    soft_time_limit=60,
)
def process_event(cache_key, start_time=None, event_id=None, **kwargs):
    return _do_process_event(cache_key, start_time, event_id, process_event)


@instrumented_task(
    name='sentry.tasks.store.process_event_from_reprocessing',
    queue='events.reprocessing.process_event',
    time_limit=65,
    soft_time_limit=60,
)
def process_event_from_reprocessing(cache_key, start_time=None, event_id=None, **kwargs):
    return _do_process_event(cache_key, start_time, event_id,
                             process_event_from_reprocessing)


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


def create_failed_event(cache_key, project_id, issues, event_id, start_time=None,
                        reprocessing_rev=None):
    """If processing failed we put the original data from the cache into a
    raw event.  Returns `True` if a failed event was inserted
    """
    reprocessing_active = ProjectOption.objects.get_value(
        project_id, 'sentry:reprocessing_active', REPROCESSING_DEFAULT
    )

    # In case there is reprocessing active but the current reprocessing
    # revision is already different than when we started, we want to
    # immediately retry the event.  This resolves the problem when
    # otherwise a concurrent change of debug symbols might leave a
    # reprocessing issue stuck in the project forever.
    if reprocessing_active and \
       reprocessing.get_reprocessing_revision(project_id, cached=False) != \
       reprocessing_rev:
        raise RetryProcessing()

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

    data = CanonicalKeyDict(data)
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
def save_event(cache_key=None, data=None, start_time=None, event_id=None,
               project_id=None, **kwargs):
    """
    Saves an event to the database.
    """
    from sentry.event_manager import HashDiscarded, EventManager
    from sentry import quotas, tsdb
    from sentry.models import ProjectKey

    if cache_key:
        data = default_cache.get(cache_key)

    if data is not None:
        data = CanonicalKeyDict(data)

    if event_id is None and data is not None:
        event_id = data['event_id']

    # only when we come from reprocessing we get a project_id sent into
    # the task.
    if project_id is None:
        project_id = data.pop('project')

    delete_raw_event(project_id, event_id, allow_hint_clear=True)

    # This covers two cases: where data is None because we did not manage
    # to fetch it from the default cache or the empty dictionary was
    # stored in the default cache.  The former happens if the event
    # expired while being on the queue, the second happens on reprocessing
    # if the raw event was deleted concurrently while we held on to
    # it.  This causes the node store to delete the data and we end up
    # fetching an empty dict.  We could in theory not invoke `save_event`
    # in those cases but it's important that we always clean up the
    # reprocessing reports correctly or they will screw up the UI.  So
    # to future proof this correctly we just handle this case here.
    if not data:
        metrics.incr('events.failed', tags={'reason': 'cache', 'stage': 'post'})
        return

    Raven.tags_context({
        'project': project_id,
    })

    try:
        manager = EventManager(data)
        manager.save(project_id)
    except HashDiscarded:
        increment_list = [
            (tsdb.models.project_total_received_discarded, project_id),
        ]

        try:
            project = Project.objects.get_from_cache(id=project_id)
        except Project.DoesNotExist:
            pass
        else:
            increment_list.extend([
                (tsdb.models.project_total_blacklisted, project.id),
                (tsdb.models.organization_total_blacklisted, project.organization_id),
            ])

            project_key = None
            if data.get('key_id') is not None:
                try:
                    project_key = ProjectKey.objects.get_from_cache(id=data['key_id'])
                except ProjectKey.DoesNotExist:
                    pass
                else:
                    increment_list.append((tsdb.models.key_total_blacklisted, project_key.id))

            quotas.refund(
                project,
                key=project_key,
                timestamp=start_time,
            )

        tsdb.incr_multi(
            increment_list,
            timestamp=to_datetime(start_time) if start_time is not None else None,
        )

    finally:
        if cache_key:
            default_cache.delete(cache_key)
        if start_time:
            metrics.timing(
                'events.time-to-process',
                time() - start_time,
                instance=data['platform'])
