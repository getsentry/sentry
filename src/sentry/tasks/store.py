import logging
import random
from datetime import datetime
from time import sleep, time

import sentry_sdk
from django.conf import settings
from django.utils import timezone
from sentry_relay.processing import StoreNormalizer

from sentry import options, reprocessing, reprocessing2
from sentry.attachments import attachment_cache
from sentry.constants import DEFAULT_STORE_NORMALIZER_ARGS
from sentry.datascrubbing import scrub_data
from sentry.eventstore.processing import event_processing_store
from sentry.killswitches import killswitch_matches_context
from sentry.models import Activity, Organization, Project, ProjectOption
from sentry.processing import realtime_metrics
from sentry.stacktraces.processing import process_stacktraces, should_process_for_stacktraces
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.canonical import CANONICAL_TYPES, CanonicalKeyDict
from sentry.utils.dates import to_datetime
from sentry.utils.safe import safe_execute
from sentry.utils.sdk import set_current_event_project

error_logger = logging.getLogger("sentry.errors.events")
info_logger = logging.getLogger("sentry.store")

# Is reprocessing on or off by default?
REPROCESSING_DEFAULT = False

SYMBOLICATOR_MAX_RETRY_AFTER = settings.SYMBOLICATOR_MAX_RETRY_AFTER

# The maximum number of times an event will be moved between the normal
# and low priority queues
SYMBOLICATOR_MAX_QUEUE_SWITCHES = 3


class RetryProcessing(Exception):
    pass


class RetrySymbolication(Exception):
    def __init__(self, retry_after=None):
        self.retry_after = retry_after


@metrics.wraps("should_process")
def should_process(data):
    """Quick check if processing is needed at all."""
    from sentry.plugins.base import plugins

    if data.get("type") == "transaction":
        return False

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


def submit_process(
    project,
    from_reprocessing,
    cache_key,
    event_id,
    start_time,
    data_has_changed=None,
):
    task = process_event_from_reprocessing if from_reprocessing else process_event
    task.delay(
        cache_key=cache_key,
        start_time=start_time,
        event_id=event_id,
        data_has_changed=data_has_changed,
    )


def should_demote_symbolication(project_id: int) -> bool:
    """
    Determines whether a project's symbolication events should be pushed to the low priority queue.

    The decision is made based on three factors, in order:
        1. is the store.symbolicate-event-lpq-never killswitch set for the project? -> normal queue
        2. is the store.symbolicate-event-lpq-always killswitch set for the project? -> low priority queue
        3. has the project been selected for the lpq according to realtime_metrics? -> low priority queue

    Note that 3 is gated behind the config setting SENTRY_ENABLE_AUTO_LOW_PRIORITY_QUEUE.
    """
    always_lowpri = killswitch_matches_context(
        "store.symbolicate-event-lpq-always",
        {
            "project_id": project_id,
        },
    )
    never_lowpri = killswitch_matches_context(
        "store.symbolicate-event-lpq-never",
        {
            "project_id": project_id,
        },
    )

    if never_lowpri:
        return False
    elif always_lowpri:
        return True
    else:
        return settings.SENTRY_ENABLE_AUTO_LOW_PRIORITY_QUEUE and realtime_metrics.is_lpq_project(
            project_id
        )


def submit_symbolicate(
    is_low_priority, from_reprocessing, cache_key, event_id, start_time, data, queue_switches=0
):
    if is_low_priority:
        task = (
            symbolicate_event_from_reprocessing_low_priority
            if from_reprocessing
            else symbolicate_event_low_priority
        )
    else:
        task = symbolicate_event_from_reprocessing if from_reprocessing else symbolicate_event

    task.delay(
        cache_key=cache_key,
        start_time=start_time,
        event_id=event_id,
        data=data,
        queue_switches=queue_switches,
    )


def submit_save_event(project_id, from_reprocessing, cache_key, event_id, start_time, data):
    if cache_key:
        data = None

    # XXX: honor from_reprocessing

    save_event.delay(
        cache_key=cache_key,
        data=data,
        start_time=start_time,
        event_id=event_id,
        project_id=project_id,
    )


def _do_preprocess_event(cache_key, data, start_time, event_id, process_task, project):
    from sentry.lang.native.processing import should_process_with_symbolicator

    if cache_key and data is None:
        data = event_processing_store.get(cache_key)

    if data is None:
        metrics.incr("events.failed", tags={"reason": "cache", "stage": "pre"}, skip_internal=False)
        error_logger.error("preprocess.failed.empty", extra={"cache_key": cache_key})
        return

    original_data = data
    data = CanonicalKeyDict(data)
    project_id = data["project"]
    set_current_event_project(project_id)

    if project is None:
        project = Project.objects.get_from_cache(id=project_id)
    else:
        assert project.id == project_id, (project.id, project_id)

    from_reprocessing = process_task is process_event_from_reprocessing

    with metrics.timer("tasks.store.preprocess_event.organization.get_from_cache"):
        project.set_cached_field_value(
            "organization", Organization.objects.get_from_cache(id=project.organization_id)
        )

    if should_process_with_symbolicator(data):
        reprocessing2.backup_unprocessed_event(project=project, data=original_data)

        is_low_priority = should_demote_symbolication(project_id)
        submit_symbolicate(
            is_low_priority,
            from_reprocessing,
            cache_key,
            event_id,
            start_time,
            original_data,
        )
        return

    if should_process(data):
        submit_process(
            project,
            from_reprocessing,
            cache_key,
            event_id,
            start_time,
            data_has_changed=False,
        )
        return

    submit_save_event(project_id, from_reprocessing, cache_key, event_id, start_time, original_data)


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
        process_task=process_event_from_reprocessing,
        project=project,
    )


def _do_symbolicate_event(
    cache_key, start_time, event_id, symbolicate_task, data=None, queue_switches=0
):
    from sentry.lang.native.processing import get_symbolication_function

    if data is None:
        data = event_processing_store.get(cache_key)

    if data is None:
        metrics.incr(
            "events.failed", tags={"reason": "cache", "stage": "symbolicate"}, skip_internal=False
        )
        error_logger.error("symbolicate.failed.empty", extra={"cache_key": cache_key})
        return

    data = CanonicalKeyDict(data)

    project_id = data["project"]
    set_current_event_project(project_id)

    event_id = data["event_id"]

    from_reprocessing = (
        symbolicate_task is symbolicate_event_from_reprocessing
        or symbolicate_task is symbolicate_event_from_reprocessing_low_priority
    )

    # check whether the event is in the wrong queue and if so, move it to the other one.
    # we do this at most SYMBOLICATOR_MAX_QUEUE_SWITCHES times.
    if queue_switches >= SYMBOLICATOR_MAX_QUEUE_SWITCHES:
        metrics.incr("tasks.store.symbolicate_event.low_priority.max_queue_switches", sample_rate=1)
    else:
        is_low_priority = symbolicate_task in [
            symbolicate_event_low_priority,
            symbolicate_event_from_reprocessing_low_priority,
        ]
        should_be_low_priority = should_demote_symbolication(project_id)

        if is_low_priority != should_be_low_priority:
            metrics.incr("tasks.store.symbolicate_event.low_priority.wrong_queue", sample_rate=1)
            submit_symbolicate(
                should_be_low_priority,
                from_reprocessing,
                cache_key,
                event_id,
                start_time,
                data,
                queue_switches + 1,
            )
            return

    def _continue_to_process_event():
        process_task = process_event_from_reprocessing if from_reprocessing else process_event
        _do_process_event(
            cache_key=cache_key,
            start_time=start_time,
            event_id=event_id,
            process_task=process_task,
            data=data,
            data_has_changed=has_changed,
            from_symbolicate=True,
        )

    symbolication_function = get_symbolication_function(data)
    symbolication_function_name = getattr(symbolication_function, "__name__", "none")

    if killswitch_matches_context(
        "store.load-shed-symbolicate-event-projects",
        {
            "project_id": project_id,
            "event_id": event_id,
            "platform": data.get("platform") or "null",
            "symbolication_function": symbolication_function_name,
        },
    ):
        return _continue_to_process_event()

    has_changed = False

    symbolication_start_time = time()

    submission_ratio = options.get("symbolicate-event.low-priority.metrics.submission-rate")
    submit_realtime_metrics = not from_reprocessing and random.random() < submission_ratio
    timestamp = int(symbolication_start_time)

    if submit_realtime_metrics:
        with sentry_sdk.start_span(op="tasks.store.symbolicate_event.low_priority.metrics.counter"):
            try:
                realtime_metrics.increment_project_event_counter(project_id, timestamp)
            except Exception as e:
                sentry_sdk.capture_exception(e)

    with sentry_sdk.start_span(op="tasks.store.symbolicate_event.symbolication") as span:
        span.set_data("symbolication_function", symbolication_function_name)
        with metrics.timer(
            "tasks.store.symbolicate_event.symbolication",
            tags={"symbolication_function": symbolication_function_name},
        ):
            while True:
                try:
                    with sentry_sdk.start_span(
                        op="tasks.store.symbolicate_event.%s" % symbolication_function_name
                    ) as span:
                        symbolicated_data = symbolication_function(data)
                        span.set_data("symbolicated_data", bool(symbolicated_data))

                    if symbolicated_data:
                        data = symbolicated_data
                        has_changed = True

                    break
                except RetrySymbolication as e:
                    if (
                        time() - symbolication_start_time
                    ) > settings.SYMBOLICATOR_PROCESS_EVENT_WARN_TIMEOUT:
                        error_logger.warning(
                            "symbolicate.slow",
                            extra={"project_id": project_id, "event_id": event_id},
                        )
                    if (
                        time() - symbolication_start_time
                    ) > settings.SYMBOLICATOR_PROCESS_EVENT_HARD_TIMEOUT:
                        # Do not drop event but actually continue with rest of pipeline
                        # (persisting unsymbolicated event)
                        metrics.incr(
                            "tasks.store.symbolicate_event.fatal",
                            tags={
                                "reason": "timeout",
                                "symbolication_function": symbolication_function_name,
                            },
                        )
                        error_logger.exception(
                            "symbolicate.failed.infinite_retry",
                            extra={"project_id": project_id, "event_id": event_id},
                        )
                        data.setdefault("_metrics", {})["flag.processing.error"] = True
                        data.setdefault("_metrics", {})["flag.processing.fatal"] = True
                        has_changed = True
                        break
                    else:
                        # sleep for `retry_after` but max 5 seconds and try again
                        metrics.incr(
                            "tasks.store.symbolicate_event.retry",
                            tags={"symbolication_function": symbolication_function_name},
                        )
                        sleep(min(e.retry_after, SYMBOLICATOR_MAX_RETRY_AFTER))
                        continue
                except Exception:
                    metrics.incr(
                        "tasks.store.symbolicate_event.fatal",
                        tags={
                            "reason": "error",
                            "symbolication_function": symbolication_function_name,
                        },
                    )
                    error_logger.exception("tasks.store.symbolicate_event.symbolication")
                    data.setdefault("_metrics", {})["flag.processing.error"] = True
                    data.setdefault("_metrics", {})["flag.processing.fatal"] = True
                    has_changed = True
                    break

    if submit_realtime_metrics:
        with sentry_sdk.start_span(
            op="tasks.store.symbolicate_event.low_priority.metrics.histogram"
        ):
            symbolication_duration = int(time() - symbolication_start_time)
            try:
                realtime_metrics.increment_project_duration_counter(
                    project_id, timestamp, symbolication_duration
                )
            except Exception as e:
                sentry_sdk.capture_exception(e)

    # We cannot persist canonical types in the cache, so we need to
    # downgrade this.
    if isinstance(data, CANONICAL_TYPES):
        data = dict(data.items())

    if has_changed:
        cache_key = event_processing_store.store(data)

    return _continue_to_process_event()


@instrumented_task(
    name="sentry.tasks.store.symbolicate_event",
    queue="events.symbolicate_event",
    time_limit=settings.SYMBOLICATOR_PROCESS_EVENT_HARD_TIMEOUT + 30,
    soft_time_limit=settings.SYMBOLICATOR_PROCESS_EVENT_HARD_TIMEOUT + 20,
    acks_late=True,
)
def symbolicate_event(
    cache_key, start_time=None, event_id=None, data=None, queue_switches=0, **kwargs
):
    """
    Handles event symbolication using the external service: symbolicator.

    :param string cache_key: the cache key for the event data
    :param int start_time: the timestamp when the event was ingested
    :param string event_id: the event identifier
    """
    return _do_symbolicate_event(
        cache_key=cache_key,
        start_time=start_time,
        event_id=event_id,
        symbolicate_task=symbolicate_event,
        data=data,
        queue_switches=queue_switches,
    )


@instrumented_task(
    name="sentry.tasks.store.symbolicate_event_low_priority",
    queue="events.symbolicate_event_low_priority",
    time_limit=settings.SYMBOLICATOR_PROCESS_EVENT_HARD_TIMEOUT + 30,
    soft_time_limit=settings.SYMBOLICATOR_PROCESS_EVENT_HARD_TIMEOUT + 20,
    acks_late=True,
)
def symbolicate_event_low_priority(
    cache_key, start_time=None, event_id=None, data=None, queue_switches=0, **kwargs
):
    """
    Handles event symbolication using the external service: symbolicator.

    This puts the task on the low priority queue. Projects whose symbolication
    events misbehave get sent there to protect the main queue.

    :param string cache_key: the cache key for the event data
    :param int start_time: the timestamp when the event was ingested
    :param string event_id: the event identifier
    """
    return _do_symbolicate_event(
        cache_key=cache_key,
        start_time=start_time,
        event_id=event_id,
        symbolicate_task=symbolicate_event_low_priority,
        data=data,
        queue_switches=queue_switches,
    )


@instrumented_task(
    name="sentry.tasks.store.symbolicate_event_from_reprocessing",
    queue="events.reprocessing.symbolicate_event",
    time_limit=settings.SYMBOLICATOR_PROCESS_EVENT_HARD_TIMEOUT + 30,
    soft_time_limit=settings.SYMBOLICATOR_PROCESS_EVENT_HARD_TIMEOUT + 20,
    acks_late=True,
)
def symbolicate_event_from_reprocessing(
    cache_key, start_time=None, event_id=None, data=None, queue_switches=0, **kwargs
):
    return _do_symbolicate_event(
        cache_key=cache_key,
        start_time=start_time,
        event_id=event_id,
        symbolicate_task=symbolicate_event_from_reprocessing,
        data=data,
        queue_switches=queue_switches,
    )


@instrumented_task(
    name="sentry.tasks.store.symbolicate_event_from_reprocessing_low_priority",
    queue="events.reprocessing.symbolicate_event_low_priority",
    time_limit=settings.SYMBOLICATOR_PROCESS_EVENT_HARD_TIMEOUT + 30,
    soft_time_limit=settings.SYMBOLICATOR_PROCESS_EVENT_HARD_TIMEOUT + 20,
    acks_late=True,
)
def symbolicate_event_from_reprocessing_low_priority(
    cache_key, start_time=None, event_id=None, data=None, queue_switches=0, **kwargs
):
    return _do_symbolicate_event(
        cache_key=cache_key,
        start_time=start_time,
        event_id=event_id,
        symbolicate_task=symbolicate_event_from_reprocessing_low_priority,
        data=data,
        queue_switches=queue_switches,
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
        raise ValueError(f"Invalid argument for process_task_name: {process_task_name}")

    process_task.delay(**task_kwargs)


def _do_process_event(
    cache_key,
    start_time,
    event_id,
    process_task,
    data=None,
    data_has_changed=None,
    from_symbolicate=False,
):
    from sentry.plugins.base import plugins

    if data is None:
        data = event_processing_store.get(cache_key)

    if data is None:
        metrics.incr(
            "events.failed", tags={"reason": "cache", "stage": "process"}, skip_internal=False
        )
        error_logger.error("process.failed.empty", extra={"cache_key": cache_key})
        return

    data = CanonicalKeyDict(data)

    project_id = data["project"]
    set_current_event_project(project_id)

    event_id = data["event_id"]

    def _continue_to_save_event():
        from_reprocessing = process_task is process_event_from_reprocessing
        submit_save_event(project_id, from_reprocessing, cache_key, event_id, start_time, data)

    if killswitch_matches_context(
        "store.load-shed-process-event-projects",
        {
            "project_id": project_id,
            "event_id": event_id,
            "platform": data.get("platform") or "null",
        },
    ):
        return _continue_to_save_event()

    with sentry_sdk.start_span(op="tasks.store.process_event.get_project_from_cache"):
        project = Project.objects.get_from_cache(id=project_id)

    with metrics.timer("tasks.store.process_event.organization.get_from_cache"):
        project.set_cached_field_value(
            "organization", Organization.objects.get_from_cache(id=project.organization_id)
        )

    has_changed = bool(data_has_changed)

    with sentry_sdk.start_span(op="tasks.store.process_event.get_reprocessing_revision"):
        # Fetch the reprocessing revision
        reprocessing_rev = reprocessing.get_reprocessing_revision(project_id)

    # Stacktrace based event processors.
    with sentry_sdk.start_span(op="task.store.process_event.stacktraces"):
        with metrics.timer(
            "tasks.store.process_event.stacktraces", tags={"from_symbolicate": from_symbolicate}
        ):
            new_data = process_stacktraces(data)

    if new_data is not None:
        has_changed = True
        data = new_data

    # Second round of datascrubbing after stacktrace and language-specific
    # processing. First round happened as part of ingest.
    #
    # *Right now* the only sensitive data that is added in stacktrace
    # processing are usernames in filepaths, so we run directly after
    # stacktrace processors.
    #
    # We do not yet want to deal with context data produced by plugins like
    # sessionstack or fullstory (which are in `get_event_preprocessors`), as
    # this data is very unlikely to be sensitive data. This is why scrubbing
    # happens somewhere in the middle of the pipeline.
    #
    # On the other hand, Javascript event error translation is happening after
    # this block because it uses `get_event_preprocessors` instead of
    # `get_event_enhancers`.
    #
    # We are fairly confident, however, that this should run *before*
    # re-normalization as it is hard to find sensitive data in partially
    # trimmed strings.
    if has_changed and options.get("processing.can-use-scrubbers"):
        with sentry_sdk.start_span(op="task.store.datascrubbers.scrub"):
            with metrics.timer(
                "tasks.store.datascrubbers.scrub", tags={"from_symbolicate": from_symbolicate}
            ):
                new_data = safe_execute(
                    scrub_data, project=project, event=data.data, _with_transaction=False
                )

                # XXX(markus): When datascrubbing is finally "totally stable", we might want
                # to drop the event if it crashes to avoid saving PII
                if new_data is not None:
                    data.data = new_data

    # TODO(dcramer): ideally we would know if data changed by default
    # Default event processors.
    for plugin in plugins.all(version=2):
        with sentry_sdk.start_span(op="task.store.process_event.preprocessors") as span:
            span.set_data("plugin", plugin.slug)
            span.set_data("from_symbolicate", from_symbolicate)
            with metrics.timer(
                "tasks.store.process_event.preprocessors",
                tags={"plugin": plugin.slug, "from_symbolicate": from_symbolicate},
            ):
                processors = safe_execute(
                    plugin.get_event_preprocessors, data=data, _with_transaction=False
                )
                for processor in processors or ():
                    try:
                        result = processor(data)
                    except Exception:
                        error_logger.exception("tasks.store.preprocessors.error")
                        data.setdefault("_metrics", {})["flag.processing.error"] = True
                        has_changed = True
                    else:
                        if result:
                            data = result
                            has_changed = True

    assert data["project"] == project_id, "Project cannot be mutated by plugins"

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
            # invoke ourselves again.  This happens when the reprocessing
            # revision changed while we were processing.
            _do_preprocess_event(cache_key, data, start_time, event_id, process_task, project)
            return

        cache_key = event_processing_store.store(data)

    return _continue_to_save_event()


@instrumented_task(
    name="sentry.tasks.store.process_event",
    queue="events.process_event",
    time_limit=65,
    soft_time_limit=60,
)
def process_event(cache_key, start_time=None, event_id=None, data_has_changed=None, **kwargs):
    """
    Handles event processing (for those events that need it)

    This excludes symbolication via symbolicator service (see symbolicate_event).

    :param string cache_key: the cache key for the event data
    :param int start_time: the timestamp when the event was ingested
    :param string event_id: the event identifier
    :param boolean data_has_changed: set to True if the event data was changed in previous tasks
    """
    return _do_process_event(
        cache_key=cache_key,
        start_time=start_time,
        event_id=event_id,
        process_task=process_event,
        data_has_changed=data_has_changed,
    )


@instrumented_task(
    name="sentry.tasks.store.process_event_from_reprocessing",
    queue="events.reprocessing.process_event",
    time_limit=65,
    soft_time_limit=60,
)
def process_event_from_reprocessing(
    cache_key, start_time=None, event_id=None, data_has_changed=None, **kwargs
):
    return _do_process_event(
        cache_key=cache_key,
        start_time=start_time,
        event_id=event_id,
        process_task=process_event_from_reprocessing,
        data_has_changed=data_has_changed,
    )


def delete_raw_event(project_id, event_id, allow_hint_clear=False):
    set_current_event_project(project_id)

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
    set_current_event_project(project_id)

    # We can only create failed events for events that can potentially
    # create failed events.
    if not reprocessing.event_supports_reprocessing(data):
        return False

    # If this event has just been reprocessed with reprocessing-v2, we don't
    # put it through reprocessing-v1 again. The value of reprocessing-v2 is
    # partially that one sees the entire event even in its failed state, all
    # the time.
    if reprocessing2.is_reprocessed_event(data):
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
    data = event_processing_store.get(cache_key)

    if data is None:
        metrics.incr("events.failed", tags={"reason": "cache", "stage": "raw"}, skip_internal=False)
        error_logger.error("process.failed_raw.empty", extra={"cache_key": cache_key})
        return True

    data = CanonicalKeyDict(data)
    from sentry.models import ProcessingIssue, RawEvent

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

    event_processing_store.delete_by_key(cache_key)

    return True


def _do_save_event(
    cache_key=None, data=None, start_time=None, event_id=None, project_id=None, **kwargs
):
    """
    Saves an event to the database.
    """

    set_current_event_project(project_id)

    from sentry.event_manager import EventManager, HashDiscarded

    event_type = "none"

    if cache_key and data is None:
        with metrics.timer("tasks.store.do_save_event.get_cache") as metric_tags:
            data = event_processing_store.get(cache_key)
            if data is not None:
                metric_tags["event_type"] = event_type = data.get("type") or "none"

    with metrics.global_tags(event_type=event_type):
        if data is not None:
            data = CanonicalKeyDict(data)

        if event_id is None and data is not None:
            event_id = data["event_id"]

        # only when we come from reprocessing we get a project_id sent into
        # the task.
        if project_id is None:
            project_id = data.pop("project")
            set_current_event_project(project_id)

        # We only need to delete raw events for events that support
        # reprocessing.  If the data cannot be found we want to assume
        # that we need to delete the raw event.
        if not data or reprocessing.event_supports_reprocessing(data):
            with metrics.timer("tasks.store.do_save_event.delete_raw_event"):
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

        try:
            if killswitch_matches_context(
                "store.load-shed-save-event-projects",
                {
                    "project_id": project_id,
                    "event_type": event_type,
                    "platform": data.get("platform") or "none",
                },
            ):
                raise HashDiscarded("Load shedding save_event")

            with metrics.timer("tasks.store.do_save_event.event_manager.save"):
                manager = EventManager(data)
                # event.project.organization is populated after this statement.
                manager.save(
                    project_id, assume_normalized=True, start_time=start_time, cache_key=cache_key
                )
                # Put the updated event back into the cache so that post_process
                # has the most recent data.
                data = manager.get_data()
                if isinstance(data, CANONICAL_TYPES):
                    data = dict(data.items())
                with metrics.timer("tasks.store.do_save_event.write_processing_cache"):
                    event_processing_store.store(data)
        except HashDiscarded:
            # Delete the event payload from cache since it won't show up in post-processing.
            if cache_key:
                with metrics.timer("tasks.store.do_save_event.delete_cache"):
                    event_processing_store.delete_by_key(cache_key)

        finally:
            reprocessing2.mark_event_reprocessed(data)
            if cache_key:
                with metrics.timer("tasks.store.do_save_event.delete_attachment_cache"):
                    attachment_cache.delete(cache_key)

            if start_time:
                metrics.timing(
                    "events.time-to-process",
                    time() - start_time,
                    instance=data["platform"],
                    tags={
                        "is_reprocessing2": "true"
                        if reprocessing2.is_reprocessed_event(data)
                        else "false",
                    },
                )

            time_synthetic_monitoring_event(data, project_id, start_time)


def time_synthetic_monitoring_event(data, project_id, start_time):
    """
    For special events produced by the recurring synthetic monitoring
    functions, emit timing metrics for:

    - "events.synthetic-monitoring.time-to-ingest-total" - Total time with
    the client submission latency included. Rely on timestamp provided by
    client as part of the event payload.

    - "events.synthetic-monitoring.time-to-process" - Processing time inside
    by sentry. `start_time` is added to the payload by the system entrypoint
    (relay).

    If an event was produced by synthetic monitoring and metrics emitted,
    returns `True` otherwise returns `False`.
    """
    sm_project_id = getattr(settings, "SENTRY_SYNTHETIC_MONITORING_PROJECT_ID", None)
    if sm_project_id is None or project_id != sm_project_id:
        return False

    extra = data.get("extra", {}).get("_sentry_synthetic_monitoring")
    if not extra:
        return False

    now = time()
    tags = {
        "target": extra["target"],
        "source_region": extra["source_region"],
        "source": extra["source"],
    }

    metrics.timing(
        "events.synthetic-monitoring.time-to-ingest-total",
        now - data["timestamp"],
        tags=tags,
        sample_rate=1.0,
    )

    if start_time:
        metrics.timing(
            "events.synthetic-monitoring.time-to-process",
            now - start_time,
            tags=tags,
            sample_rate=1.0,
        )
    return True


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
