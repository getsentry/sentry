import logging
from datetime import datetime
from time import time
from typing import Any, Callable, Dict, List, Optional

import sentry_sdk
from django.conf import settings
from django.utils import timezone
from sentry_relay.processing import StoreNormalizer

from sentry import options, reprocessing, reprocessing2
from sentry.attachments import attachment_cache
from sentry.constants import DEFAULT_STORE_NORMALIZER_ARGS
from sentry.datascrubbing import scrub_data
from sentry.eventstore import processing
from sentry.eventstore.processing.base import Event
from sentry.killswitches import killswitch_matches_context
from sentry.lang.native.symbolicator import SymbolicatorTaskKind
from sentry.models import Activity, Organization, Project, ProjectOption
from sentry.stacktraces.processing import process_stacktraces, should_process_for_stacktraces
from sentry.tasks.base import instrumented_task
from sentry.types.activity import ActivityType
from sentry.utils import metrics
from sentry.utils.canonical import CANONICAL_TYPES, CanonicalKeyDict
from sentry.utils.dates import to_datetime
from sentry.utils.safe import safe_execute
from sentry.utils.sdk import set_current_event_project

error_logger = logging.getLogger("sentry.errors.events")
info_logger = logging.getLogger("sentry.store")

# Is reprocessing on or off by default?
REPROCESSING_DEFAULT = False


class RetryProcessing(Exception):
    pass


@metrics.wraps("should_process")
def should_process(data: CanonicalKeyDict) -> bool:
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

    if should_process_for_stacktraces(data):
        return True

    return False


def submit_process(
    from_reprocessing: bool,
    cache_key: str,
    event_id: Optional[str],
    start_time: Optional[int],
    data_has_changed: bool = False,
    from_symbolicate: bool = False,
    has_attachments: bool = False,
) -> None:
    task = process_event_from_reprocessing if from_reprocessing else process_event
    task.delay(
        cache_key=cache_key,
        start_time=start_time,
        event_id=event_id,
        data_has_changed=data_has_changed,
        from_symbolicate=from_symbolicate,
        has_attachments=has_attachments,
    )


def submit_save_event(
    project_id: int,
    from_reprocessing: bool,
    cache_key: Optional[str],
    event_id: Optional[str],
    start_time: Optional[int],
    data: Optional[Event],
    has_attachments: bool,
) -> None:
    if cache_key:
        data = None

    # XXX: honor from_reprocessing

    task_kwargs = {
        "cache_key": cache_key,
        "data": data,
        "start_time": start_time,
        "event_id": event_id,
        "project_id": project_id,
    }

    (save_event_attachments if has_attachments else save_event).delay(**task_kwargs)


def _do_preprocess_event(
    cache_key: str,
    data: Optional[Event],
    start_time: Optional[int],
    event_id: Optional[str],
    process_task: Callable[[Optional[str], Optional[int], Optional[str], bool], None],
    project: Optional[Project],
    has_attachments: bool = False,
) -> None:
    from sentry.tasks.symbolication import should_demote_symbolication, submit_symbolicate

    if cache_key and data is None:
        data = processing.event_processing_store.get(cache_key)

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

    is_js = False
    if data["platform"] in ("javascript", "node"):
        from sentry.lang.javascript.processing import (
            get_js_symbolication_function as get_symbolication_function,
        )

        is_js = True
    else:
        from sentry.lang.native.processing import (
            get_native_symbolication_function as get_symbolication_function,
        )

    symbolication_function = get_symbolication_function(data)
    if symbolication_function:
        symbolication_function_name = getattr(symbolication_function, "__name__", "none")

        if not killswitch_matches_context(
            "store.load-shed-symbolicate-event-projects",
            {
                "project_id": project_id,
                "event_id": event_id,
                "platform": data.get("platform") or "null",
                "symbolication_function": symbolication_function_name,
            },
        ):
            reprocessing2.backup_unprocessed_event(data=original_data)

            is_low_priority = should_demote_symbolication(project_id)
            task_kind = SymbolicatorTaskKind(
                is_js=is_js, is_low_priority=is_low_priority, is_reprocessing=from_reprocessing
            )
            submit_symbolicate(
                task_kind,
                cache_key=cache_key,
                event_id=event_id,
                start_time=start_time,
                has_attachments=has_attachments,
            )
            return
        # else: go directly to process, do not go through the symbolicate queue, do not collect 200

    # NOTE: Events considered for symbolication always go through `do_process_event`
    if symbolication_function or should_process(data):
        submit_process(
            from_reprocessing=from_reprocessing,
            cache_key=cache_key,
            event_id=event_id,
            start_time=start_time,
            data_has_changed=False,
            has_attachments=has_attachments,
        )
        return

    submit_save_event(
        project_id=project_id,
        from_reprocessing=from_reprocessing,
        cache_key=cache_key,
        event_id=event_id,
        start_time=start_time,
        data=original_data,
        has_attachments=has_attachments,
    )


@instrumented_task(  # type: ignore
    name="sentry.tasks.store.preprocess_event",
    queue="events.preprocess_event",
    time_limit=65,
    soft_time_limit=60,
)
def preprocess_event(
    cache_key: str,
    data: Optional[Event] = None,
    start_time: Optional[int] = None,
    event_id: Optional[str] = None,
    project: Optional[Project] = None,
    has_attachments: bool = False,
    **kwargs: Any,
) -> None:
    return _do_preprocess_event(
        cache_key=cache_key,
        data=data,
        start_time=start_time,
        event_id=event_id,
        process_task=process_event,
        project=project,
        has_attachments=has_attachments,
    )


@instrumented_task(  # type: ignore
    name="sentry.tasks.store.preprocess_event_from_reprocessing",
    queue="events.reprocessing.preprocess_event",
    time_limit=65,
    soft_time_limit=60,
)
def preprocess_event_from_reprocessing(
    cache_key: str,
    data: Optional[Event] = None,
    start_time: Optional[int] = None,
    event_id: Optional[str] = None,
    project: Optional[Project] = None,
    **kwargs: Any,
) -> None:
    return _do_preprocess_event(
        cache_key=cache_key,
        data=data,
        start_time=start_time,
        event_id=event_id,
        process_task=process_event_from_reprocessing,
        project=project,
    )


@instrumented_task(  # type: ignore
    name="sentry.tasks.store.retry_process_event",
    queue="sleep",
    time_limit=(60 * 5) + 5,
    soft_time_limit=60 * 5,
)
def retry_process_event(process_task_name: str, task_kwargs: Dict[str, Any], **kwargs: Any) -> None:
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


def do_process_event(
    cache_key: str,
    start_time: Optional[int],
    event_id: Optional[str],
    process_task: Callable[[Optional[str], Optional[int], Optional[str], bool], None],
    data: Optional[Event] = None,
    data_has_changed: bool = False,
    from_symbolicate: bool = False,
    has_attachments: bool = False,
) -> None:
    from sentry.plugins.base import plugins

    if data is None:
        data = processing.event_processing_store.get(cache_key)

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

    def _continue_to_save_event() -> None:
        from_reprocessing = process_task is process_event_from_reprocessing
        submit_save_event(
            project_id=project_id,
            from_reprocessing=from_reprocessing,
            cache_key=cache_key,
            event_id=event_id,
            start_time=start_time,
            data=data,
            has_attachments=has_attachments,
        )

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

    has_changed = data_has_changed

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
    # this block because it uses `get_event_preprocessors`.
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

        cache_key = processing.event_processing_store.store(data)

    return _continue_to_save_event()


@instrumented_task(  # type: ignore
    name="sentry.tasks.store.process_event",
    queue="events.process_event",
    time_limit=65,
    soft_time_limit=60,
)
def process_event(
    cache_key: str,
    start_time: Optional[int] = None,
    event_id: Optional[str] = None,
    data_has_changed: bool = False,
    from_symbolicate: bool = False,
    has_attachments: bool = False,
    **kwargs: Any,
) -> None:
    """
    Handles event processing (for those events that need it)

    This excludes symbolication via symbolicator service (see symbolicate_event).

    :param string cache_key: the cache key for the event data
    :param int start_time: the timestamp when the event was ingested
    :param string event_id: the event identifier
    :param boolean data_has_changed: set to True if the event data was changed in previous tasks
    """
    return do_process_event(
        cache_key=cache_key,
        start_time=start_time,
        event_id=event_id,
        process_task=process_event,
        data_has_changed=data_has_changed,
        from_symbolicate=from_symbolicate,
        has_attachments=has_attachments,
    )


@instrumented_task(  # type: ignore
    name="sentry.tasks.store.process_event_from_reprocessing",
    queue="events.reprocessing.process_event",
    time_limit=65,
    soft_time_limit=60,
)
def process_event_from_reprocessing(
    cache_key: str,
    start_time: Optional[int] = None,
    event_id: Optional[str] = None,
    data_has_changed: bool = False,
    from_symbolicate: bool = False,
    has_attachments: bool = False,
    **kwargs: Any,
) -> None:
    return do_process_event(
        cache_key=cache_key,
        start_time=start_time,
        event_id=event_id,
        process_task=process_event_from_reprocessing,
        data_has_changed=data_has_changed,
        from_symbolicate=from_symbolicate,
        has_attachments=has_attachments,
    )


def delete_raw_event(
    project_id: int, event_id: Optional[str], allow_hint_clear: bool = False
) -> None:
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
    cache_key: str,
    data: Optional[Event],
    project_id: int,
    issues: List[Dict[str, str]],
    event_id: Optional[str],
    start_time: Optional[int] = None,
    reprocessing_rev: Any = None,
) -> bool:
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
            type=ActivityType.NEW_PROCESSING_ISSUES.value,
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
    data = processing.event_processing_store.get(cache_key)

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

    processing.event_processing_store.delete_by_key(cache_key)

    return True


def _do_save_event(
    cache_key: Optional[str] = None,
    data: Optional[Event] = None,
    start_time: Optional[int] = None,
    event_id: Optional[str] = None,
    project_id: Optional[int] = None,
    **kwargs: Any,
) -> None:
    """
    Saves an event to the database.
    """

    set_current_event_project(project_id)

    from sentry.event_manager import EventManager, HashDiscarded

    event_type = "none"

    if cache_key and data is None:
        with metrics.timer("tasks.store.do_save_event.get_cache") as metric_tags:
            data = processing.event_processing_store.get(cache_key)
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
                    project_id,
                    assume_normalized=True,
                    start_time=start_time,
                    cache_key=cache_key,
                    auto_upgrade_grouping=event_type != "transaction",
                )
                # Put the updated event back into the cache so that post_process
                # has the most recent data.
                data = manager.get_data()
                if isinstance(data, CANONICAL_TYPES):
                    data = dict(data.items())
                with metrics.timer("tasks.store.do_save_event.write_processing_cache"):
                    processing.event_processing_store.store(data)
        except HashDiscarded:
            # Delete the event payload from cache since it won't show up in post-processing.
            if cache_key:
                with metrics.timer("tasks.store.do_save_event.delete_cache"):
                    processing.event_processing_store.delete_by_key(cache_key)
        except Exception:
            metrics.incr("events.save_event.exception", tags={"event_type": event_type})
            raise

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


def time_synthetic_monitoring_event(
    data: Event, project_id: int, start_time: Optional[int]
) -> bool:
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


@instrumented_task(  # type: ignore
    name="sentry.tasks.store.save_event",
    queue="events.save_event",
    time_limit=65,
    soft_time_limit=60,
)
def save_event(
    cache_key: Optional[str] = None,
    data: Optional[Event] = None,
    start_time: Optional[int] = None,
    event_id: Optional[str] = None,
    project_id: Optional[int] = None,
    **kwargs: Any,
) -> None:
    _do_save_event(cache_key, data, start_time, event_id, project_id, **kwargs)


@instrumented_task(  # type: ignore
    name="sentry.tasks.store.save_event_transaction",
    queue="events.save_event_transaction",
    time_limit=65,
    soft_time_limit=60,
)
def save_event_transaction(
    cache_key: Optional[str] = None,
    data: Optional[Event] = None,
    start_time: Optional[int] = None,
    event_id: Optional[str] = None,
    project_id: Optional[int] = None,
    **kwargs: Any,
) -> None:
    _do_save_event(cache_key, data, start_time, event_id, project_id, **kwargs)


@instrumented_task(  # type: ignore
    name="sentry.tasks.store.save_event_attachments",
    queue="events.save_event_attachments",
    time_limit=65,
    soft_time_limit=60,
)
def save_event_attachments(
    cache_key: Optional[str] = None,
    data: Optional[Event] = None,
    start_time: Optional[int] = None,
    event_id: Optional[str] = None,
    project_id: Optional[int] = None,
    **kwargs: Any,
) -> None:
    _do_save_event(cache_key, data, start_time, event_id, project_id, **kwargs)
