from __future__ import absolute_import

import logging
from datetime import datetime
import six

from time import time
from django.core.cache import cache
from django.utils import timezone

from semaphore.processing import StoreNormalizer

from sentry import features, reprocessing
from sentry.constants import DEFAULT_STORE_NORMALIZER_ARGS
from sentry.attachments import attachment_cache
from sentry.cache import default_cache
from sentry.lang.native.utils import STORE_CRASH_REPORTS_ALL, convert_crashreport_count
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.safe import safe_execute
from sentry.stacktraces.processing import process_stacktraces, should_process_for_stacktraces
from sentry.utils.data_filters import FilterStatKeys
from sentry.utils.canonical import CanonicalKeyDict, CANONICAL_TYPES
from sentry.utils.dates import to_datetime
from sentry.utils.sdk import configure_scope
from sentry.models import (
    EventAttachment,
    File,
    ProjectOption,
    Activity,
    Project,
    CRASH_REPORT_TYPES,
    get_crashreport_key,
)

error_logger = logging.getLogger("sentry.errors.events")
info_logger = logging.getLogger("sentry.store")

# Is reprocessing on or off by default?
REPROCESSING_DEFAULT = False

# Timeout for cached group crash report counts
CRASH_REPORT_TIMEOUT = 24 * 3600  # one day


class RetryProcessing(Exception):
    pass


class RetrySymbolication(Exception):
    def __init__(self, retry_after=None):
        self.retry_after = retry_after


def should_process(data):
    """Quick check if processing is needed at all."""
    from sentry.plugins.base import plugins

    for plugin in plugins.all(version=2):
        processors = safe_execute(
            plugin.get_event_preprocessors, data=data, _with_transaction=False
        )
        if processors:
            return True

        enhancers = safe_execute(plugin.get_event_enhancers, data=data, _with_transaction=False)
        if enhancers:
            return True

    if should_process_for_stacktraces(data):
        return True

    return False


def submit_process(project, from_reprocessing, cache_key, event_id, start_time, data):
    task = process_event_from_reprocessing if from_reprocessing else process_event
    task.delay(cache_key=cache_key, start_time=start_time, event_id=event_id)


def submit_save_event(project, cache_key, event_id, start_time, data):
    if cache_key:
        data = None

    save_event.delay(
        cache_key=cache_key,
        data=data,
        start_time=start_time,
        event_id=event_id,
        project_id=project.id,
    )


def _do_preprocess_event(cache_key, data, start_time, event_id, process_task, project):
    if cache_key and data is None:
        data = default_cache.get(cache_key)

    if data is None:
        metrics.incr("events.failed", tags={"reason": "cache", "stage": "pre"}, skip_internal=False)
        error_logger.error("preprocess.failed.empty", extra={"cache_key": cache_key})
        return

    original_data = data
    data = CanonicalKeyDict(data)
    project_id = data["project"]

    with configure_scope() as scope:
        scope.set_tag("project", project_id)

    if project is None:
        project = Project.objects.get_from_cache(id=project_id)
    else:
        assert project.id == project_id, (project.id, project_id)

    if should_process(data):
        from_reprocessing = process_task is process_event_from_reprocessing
        submit_process(project, from_reprocessing, cache_key, event_id, start_time, original_data)
        return

    submit_save_event(project, cache_key, event_id, start_time, original_data)


@instrumented_task(
    name="sentry.tasks.store.preprocess_event",
    queue="events.preprocess_event",
    time_limit=65,
    soft_time_limit=60,
)
def preprocess_event(
    cache_key=None, data=None, start_time=None, event_id=None, project=None, **kwargs
):
    return _do_preprocess_event(
        cache_key=cache_key,
        data=data,
        start_time=start_time,
        event_id=event_id,
        process_task=process_event,
        project=project,
    )


@instrumented_task(
    name="sentry.tasks.store.preprocess_event_from_reprocessing",
    queue="events.reprocessing.preprocess_event",
    time_limit=65,
    soft_time_limit=60,
)
def preprocess_event_from_reprocessing(
    cache_key=None, data=None, start_time=None, event_id=None, project=None, **kwargs
):
    return _do_preprocess_event(
        cache_key=cache_key,
        data=data,
        start_time=start_time,
        event_id=event_id,
        process_task=process_event,
        project=project,
    )


@instrumented_task(
    name="sentry.tasks.store.retry_process_event",
    queue="sleep",
    time_limit=(60 * 5) + 5,
    soft_time_limit=60 * 5,
)
def retry_process_event(process_task_name, task_kwargs, **kwargs):
    """
    The only purpose of this task is be enqueued with some ETA set. This is
    essentially an implementation of ETAs on top of Celery's existing ETAs, but
    with the intent of having separate workers wait for those ETAs.
    """
    tasks = {
        "process_event": process_event,
        "process_event_from_reprocessing": process_event_from_reprocessing,
    }

    process_task = tasks.get(process_task_name)
    if not process_task:
        raise ValueError("Invalid argument for process_task_name: %s" % (process_task_name,))

    process_task.delay(**task_kwargs)


def _do_process_event(cache_key, start_time, event_id, process_task, data=None):
    from sentry.plugins.base import plugins

    if data is None:
        data = default_cache.get(cache_key)

    if data is None:
        metrics.incr(
            "events.failed", tags={"reason": "cache", "stage": "process"}, skip_internal=False
        )
        error_logger.error("process.failed.empty", extra={"cache_key": cache_key})
        return

    data = CanonicalKeyDict(data)
    project_id = data["project"]

    with configure_scope() as scope:
        scope.set_tag("project", project_id)

    has_changed = False

    # Fetch the reprocessing revision
    reprocessing_rev = reprocessing.get_reprocessing_revision(project_id)

    try:
        # Event enhancers.  These run before anything else.
        for plugin in plugins.all(version=2):
            enhancers = safe_execute(plugin.get_event_enhancers, data=data)
            for enhancer in enhancers or ():
                enhanced = safe_execute(enhancer, data, _passthrough_errors=(RetrySymbolication,))
                if enhanced:
                    data = enhanced
                    has_changed = True

        # Stacktrace based event processors.
        new_data = process_stacktraces(data)
        if new_data is not None:
            has_changed = True
            data = new_data
    except RetrySymbolication as e:
        if start_time and (time() - start_time) > 3600:
            # Do not drop event but actually continue with rest of pipeline
            # (persisting unsymbolicated event)
            error_logger.exception("process.failed.infinite_retry")
        else:
            retry_process_event.apply_async(
                args=(),
                kwargs={
                    "process_task_name": process_task.__name__,
                    "task_kwargs": {
                        "cache_key": cache_key,
                        "event_id": event_id,
                        "start_time": start_time,
                    },
                },
                countdown=e.retry_after,
            )
            return

    # TODO(dcramer): ideally we would know if data changed by default
    # Default event processors.
    for plugin in plugins.all(version=2):
        processors = safe_execute(
            plugin.get_event_preprocessors, data=data, _with_transaction=False
        )
        for processor in processors or ():
            result = safe_execute(processor, data)
            if result:
                data = result
                has_changed = True

    assert data["project"] == project_id, "Project cannot be mutated by preprocessor"
    project = Project.objects.get_from_cache(id=project_id)

    # We cannot persist canonical types in the cache, so we need to
    # downgrade this.
    if isinstance(data, CANONICAL_TYPES):
        data = dict(data.items())

    if has_changed:
        # Run some of normalization again such that we don't:
        # - persist e.g. incredibly large stacktraces from minidumps
        # - store event timestamps that are older than our retention window
        #   (also happening with minidumps)
        normalizer = StoreNormalizer(
            remove_other=False, is_renormalize=True, **DEFAULT_STORE_NORMALIZER_ARGS
        )
        data = normalizer.normalize_event(dict(data))

        issues = data.get("processing_issues")

        try:
            if issues and create_failed_event(
                cache_key,
                data,
                project_id,
                list(issues.values()),
                event_id=event_id,
                start_time=start_time,
                reprocessing_rev=reprocessing_rev,
            ):
                return
        except RetryProcessing:
            # If `create_failed_event` indicates that we need to retry we
            # invoke outselves again.  This happens when the reprocessing
            # revision changed while we were processing.
            from_reprocessing = process_task is process_event_from_reprocessing
            submit_process(project, from_reprocessing, cache_key, event_id, start_time, data)
            process_task.delay(cache_key, start_time=start_time, event_id=event_id)
            return

        default_cache.set(cache_key, data, 3600)

    submit_save_event(project, cache_key, event_id, start_time, data)


@instrumented_task(
    name="sentry.tasks.store.process_event",
    queue="events.process_event",
    time_limit=65,
    soft_time_limit=60,
)
def process_event(cache_key, start_time=None, event_id=None, **kwargs):
    return _do_process_event(
        cache_key=cache_key, start_time=start_time, event_id=event_id, process_task=process_event
    )


@instrumented_task(
    name="sentry.tasks.store.process_event_from_reprocessing",
    queue="events.reprocessing.process_event",
    time_limit=65,
    soft_time_limit=60,
)
def process_event_from_reprocessing(cache_key, start_time=None, event_id=None, **kwargs):
    return _do_process_event(
        cache_key=cache_key,
        start_time=start_time,
        event_id=event_id,
        process_task=process_event_from_reprocessing,
    )


def delete_raw_event(project_id, event_id, allow_hint_clear=False):
    if event_id is None:
        error_logger.error("process.failed_delete_raw_event", extra={"project_id": project_id})
        return
    from sentry.models import RawEvent, ReprocessingReport

    RawEvent.objects.filter(project_id=project_id, event_id=event_id).delete()
    ReprocessingReport.objects.filter(project_id=project_id, event_id=event_id).delete()

    # Clear the sent notification if we reprocessed everything
    # successfully and reprocessing is enabled
    reprocessing_active = ProjectOption.objects.get_value(
        project_id, "sentry:reprocessing_active", REPROCESSING_DEFAULT
    )
    if reprocessing_active:
        sent_notification = ProjectOption.objects.get_value(
            project_id, "sentry:sent_failed_event_hint", False
        )
        if sent_notification:
            if ReprocessingReport.objects.filter(project_id=project_id, event_id=event_id).exists():
                project = Project.objects.get_from_cache(id=project_id)
                ProjectOption.objects.set_value(project, "sentry:sent_failed_event_hint", False)


def create_failed_event(
    cache_key, data, project_id, issues, event_id, start_time=None, reprocessing_rev=None
):
    """If processing failed we put the original data from the cache into a
    raw event.  Returns `True` if a failed event was inserted
    """
    # We can only create failed events for events that can potentially
    # create failed events.
    if not reprocessing.event_supports_reprocessing(data):
        return False

    reprocessing_active = ProjectOption.objects.get_value(
        project_id, "sentry:reprocessing_active", REPROCESSING_DEFAULT
    )

    # In case there is reprocessing active but the current reprocessing
    # revision is already different than when we started, we want to
    # immediately retry the event.  This resolves the problem when
    # otherwise a concurrent change of debug symbols might leave a
    # reprocessing issue stuck in the project forever.
    if (
        reprocessing_active
        and reprocessing.get_reprocessing_revision(project_id, cached=False) != reprocessing_rev
    ):
        raise RetryProcessing()

    # The first time we encounter a failed event and the hint was cleared
    # we send a notification.
    sent_notification = ProjectOption.objects.get_value(
        project_id, "sentry:sent_failed_event_hint", False
    )
    if not sent_notification:
        project = Project.objects.get_from_cache(id=project_id)
        Activity.objects.create(
            type=Activity.NEW_PROCESSING_ISSUES,
            project=project,
            datetime=to_datetime(start_time),
            data={"reprocessing_active": reprocessing_active, "issues": issues},
        ).send_notification()
        ProjectOption.objects.set_value(project, "sentry:sent_failed_event_hint", True)

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
        metrics.incr("events.failed", tags={"reason": "cache", "stage": "raw"}, skip_internal=False)
        error_logger.error("process.failed_raw.empty", extra={"cache_key": cache_key})
        return True

    data = CanonicalKeyDict(data)
    from sentry.models import RawEvent, ProcessingIssue

    raw_event = RawEvent.objects.create(
        project_id=project_id,
        event_id=event_id,
        datetime=datetime.utcfromtimestamp(data["timestamp"]).replace(tzinfo=timezone.utc),
        data=data,
    )

    for issue in issues:
        ProcessingIssue.objects.record_processing_issue(
            raw_event=raw_event,
            scope=issue["scope"],
            object=issue["object"],
            type=issue["type"],
            data=issue["data"],
        )

    default_cache.delete(cache_key)

    return True


def get_max_crashreports(model):
    value = model.get_option("sentry:store_crash_reports")
    return convert_crashreport_count(value)


def crashreports_exceeded(current_count, max_count):
    if max_count == STORE_CRASH_REPORTS_ALL:
        return False
    return current_count >= max_count


def get_stored_crashreports(cache_key, event, max_crashreports):
    # There are two common cases: Storing crash reports is disabled, or is
    # unbounded. In both cases, there is no need in caching values or querying
    # the database.
    if max_crashreports in (0, STORE_CRASH_REPORTS_ALL):
        return max_crashreports

    cached_reports = cache.get(cache_key, None)
    if cached_reports >= max_crashreports:
        return cached_reports

    # Fall-through if max_crashreports was bumped to get a more accurate number.
    return EventAttachment.objects.filter(
        group_id=event.group_id, file__type__in=CRASH_REPORT_TYPES
    ).count()


def save_attachments(cache_key, event):
    """
    Persists cached event attachments into the file store.

    This method checks whether event attachments are available and sends them to
    the blob store. There is special handling for crash reports which may
    contain unstripped PII. If the project or organization is configured to
    limit the amount of crash reports per group, the number of stored crashes is
    limited.

    :param cache_key: The cache key at which the event payload is stored in the
                      cache. This is used to retrieve attachments.
    :param event:     The event model instance.
    """
    if not features.has("organizations:event-attachments", event.project.organization, actor=None):
        return

    attachments = list(attachment_cache.get(cache_key))
    if not attachments:
        return

    # The setting is both an organization and project setting. The project
    # setting strictly overrides the organization setting, unless set to the
    # default.
    max_crashreports = get_max_crashreports(event.project)
    if not max_crashreports:
        max_crashreports = get_max_crashreports(event.project.organization)

    # The number of crash reports is cached per group
    crashreports_key = get_crashreport_key(event.group_id)

    # Only fetch the number of stored crash reports if there is a crash report
    # in the list of attachments. Otherwise, we won't require this number.
    if any(attachment.type in CRASH_REPORT_TYPES for attachment in attachments):
        cached_reports = get_stored_crashreports(crashreports_key, event, max_crashreports)
    else:
        cached_reports = 0
    stored_reports = cached_reports

    for attachment in attachments:
        # If the attachment is a crash report (e.g. minidump), we need to honor
        # the store_crash_reports setting. Otherwise, we assume that the client
        # has already verified PII and just store the attachment.
        if attachment.type in CRASH_REPORT_TYPES:
            if crashreports_exceeded(stored_reports, max_crashreports):
                continue
            stored_reports += 1

        file = File.objects.create(
            name=attachment.name,
            type=attachment.type,
            headers={"Content-Type": attachment.content_type},
        )
        file.putfile(six.BytesIO(attachment.data))

        EventAttachment.objects.create(
            event_id=event.event_id,
            project_id=event.project_id,
            group_id=event.group_id,
            name=attachment.name,
            file=file,
        )

    # Check if we have exceeded the stored crash reports count. If so, we
    # persist the current maximum (not the actual number!) into the cache. Next
    # time when loading from the cache, we will validate that this number has
    # not changed, or otherwise re-fetch from the database.
    if crashreports_exceeded(stored_reports, max_crashreports) and stored_reports > cached_reports:
        cache.set(crashreports_key, max_crashreports, CRASH_REPORT_TIMEOUT)


def _do_save_event(
    cache_key=None, data=None, start_time=None, event_id=None, project_id=None, **kwargs
):
    """
    Saves an event to the database.
    """
    from sentry.event_manager import HashDiscarded, EventManager
    from sentry import quotas
    from sentry.models import ProjectKey
    from sentry.utils.outcomes import Outcome, track_outcome
    from sentry.ingest.outcomes_consumer import mark_signal_sent

    if cache_key and data is None:
        data = default_cache.get(cache_key)

    if data is not None:
        data = CanonicalKeyDict(data)

    if event_id is None and data is not None:
        event_id = data["event_id"]

    # only when we come from reprocessing we get a project_id sent into
    # the task.
    if project_id is None:
        project_id = data.pop("project")

    key_id = None if data is None else data.get("key_id")
    if key_id is not None:
        key_id = int(key_id)
    timestamp = to_datetime(start_time) if start_time is not None else None

    # We only need to delete raw events for events that support
    # reprocessing.  If the data cannot be found we want to assume
    # that we need to delete the raw event.
    if not data or reprocessing.event_supports_reprocessing(data):
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
        metrics.incr(
            "events.failed", tags={"reason": "cache", "stage": "post"}, skip_internal=False
        )
        return

    with configure_scope() as scope:
        scope.set_tag("project", project_id)

    event = None
    try:
        manager = EventManager(data)
        # event.project.organization is populated after this statement.
        event = manager.save(project_id, assume_normalized=True)

        # This is where we can finally say that we have accepted the event.
        track_outcome(
            event.project.organization_id,
            event.project.id,
            key_id,
            Outcome.ACCEPTED,
            None,
            timestamp,
            event_id,
        )

    except HashDiscarded:
        project = Project.objects.get_from_cache(id=project_id)
        reason = FilterStatKeys.DISCARDED_HASH
        project_key = None
        try:
            if key_id is not None:
                project_key = ProjectKey.objects.get_from_cache(id=key_id)
        except ProjectKey.DoesNotExist:
            pass

        quotas.refund(project, key=project_key, timestamp=start_time)
        # There is no signal supposed to be sent for this particular
        # outcome-reason combination. Prevent the outcome consumer from
        # emitting it for now.
        #
        # XXX(markus): Revisit decision about signals once outcomes consumer is stable.
        mark_signal_sent(project_id, event_id)
        track_outcome(
            project.organization_id,
            project_id,
            key_id,
            Outcome.FILTERED,
            reason,
            timestamp,
            event_id,
        )

    else:
        if cache_key:
            # Note that event is now a model, and no longer the data
            save_attachments(cache_key, event)

    finally:
        if cache_key:
            default_cache.delete(cache_key)

            # For the unlikely case that we did not manage to persist the
            # event we also delete the key always.
            if event is None or features.has(
                "organizations:event-attachments", event.project.organization, actor=None
            ):
                attachment_cache.delete(cache_key)

        if start_time:
            metrics.timing("events.time-to-process", time() - start_time, instance=data["platform"])


@instrumented_task(
    name="sentry.tasks.store.save_event",
    queue="events.save_event",
    time_limit=65,
    soft_time_limit=60,
)
def save_event(
    cache_key=None, data=None, start_time=None, event_id=None, project_id=None, **kwargs
):
    _do_save_event(cache_key, data, start_time, event_id, project_id, **kwargs)
