from __future__ import annotations

import logging
import random
from collections.abc import Mapping, MutableMapping
from dataclasses import dataclass
from time import time
from typing import Any

import orjson
import sentry_sdk
from sentry_relay.processing import StoreNormalizer

from sentry import options, reprocessing2
from sentry.attachments import attachment_cache
from sentry.constants import DEFAULT_STORE_NORMALIZER_ARGS
from sentry.datascrubbing import scrub_data
from sentry.eventstore import processing
from sentry.features.rollout import in_rollout_group
from sentry.feedback.usecases.create_feedback import FeedbackCreationSource, create_feedback_issue
from sentry.ingest.types import ConsumerType
from sentry.killswitches import killswitch_matches_context
from sentry.lang.native.symbolicator import SymbolicatorTaskKind
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.stacktraces.processing import process_stacktraces, should_process_for_stacktraces
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.event_tracker import TransactionStageStatus, track_sampled_event
from sentry.utils.safe import safe_execute
from sentry.utils.sdk import set_current_event_project

error_logger = logging.getLogger("sentry.errors.events")
info_logger = logging.getLogger("sentry.store")


class RetryProcessing(Exception):
    pass


def should_process(data: Mapping[str, Any]) -> bool:
    """Quick check if processing is needed at all."""
    from sentry.plugins.base import plugins

    if data.get("type") == "transaction":
        return False

    for plugin in plugins.all(version=2):
        processors = safe_execute(plugin.get_event_preprocessors, data=data)
        if processors:
            return True

    if should_process_for_stacktraces(data):
        return True

    return False


def submit_process(
    from_reprocessing: bool,
    cache_key: str,
    event_id: str | None,
    start_time: float | None,
    data_has_changed: bool = False,
    from_symbolicate: bool = False,
    has_attachments: bool = False,
) -> None:
    if from_reprocessing:
        task = process_event_from_reprocessing
    else:
        task = process_event
    task.delay(
        cache_key=cache_key,
        start_time=start_time,
        event_id=event_id,
        data_has_changed=data_has_changed,
        from_symbolicate=from_symbolicate,
        has_attachments=has_attachments,
    )


@dataclass(frozen=True)
class SaveEventTaskKind:
    has_attachments: bool = False
    from_reprocessing: bool = False


def submit_save_event(
    task_kind: SaveEventTaskKind,
    project_id: int,
    cache_key: str | None,
    event_id: str | None,
    start_time: float | None,
    data: MutableMapping[str, Any] | None,
) -> None:
    if cache_key:
        data = None

    # XXX: honor from_reprocessing
    if task_kind.has_attachments:
        task = save_event_attachments
    else:
        task = save_event

    task_kwargs = {
        "cache_key": cache_key,
        "data": data,
        "start_time": start_time,
        "event_id": event_id,
        "project_id": project_id,
    }

    task.delay(**task_kwargs)


def _do_preprocess_event(
    cache_key: str,
    data: MutableMapping[str, Any] | None,
    start_time: float | None,
    event_id: str | None,
    from_reprocessing: bool,
    project: Project | None,
    has_attachments: bool = False,
) -> None:
    from sentry.stacktraces.processing import find_stacktraces_in_data
    from sentry.tasks.symbolication import (
        get_symbolication_function_for_platform,
        get_symbolication_platforms,
        submit_symbolicate,
    )

    if cache_key and data is None:
        data = processing.event_processing_store.get(cache_key)

    if data is None:
        metrics.incr("events.failed", tags={"reason": "cache", "stage": "pre"}, skip_internal=False)
        error_logger.error("preprocess.failed.empty", extra={"cache_key": cache_key})
        return

    original_data = data
    project_id = data["project"]
    set_current_event_project(project_id)

    if project is None:
        project = Project.objects.get_from_cache(id=project_id)
    else:
        assert project.id == project_id, (project.id, project_id)

    project.set_cached_field_value(
        "organization", Organization.objects.get_from_cache(id=project.organization_id)
    )

    # Get the list of platforms for which we want to use Symbolicator.
    # Possible values are `js`, `jvm`, and `native`.
    # The event will be submitted to Symbolicator for all returned platforms,
    # one after the other, so we handle mixed stacktraces.
    stacktraces = find_stacktraces_in_data(data)
    symbolicate_platforms = get_symbolication_platforms(data, stacktraces)
    metrics.incr(
        "events.to-symbolicate",
        tags={platform.value: True for platform in symbolicate_platforms},
        skip_internal=False,
    )

    should_symbolicate = len(symbolicate_platforms) > 0
    if should_symbolicate:
        first_platform = symbolicate_platforms.pop(0)
        symbolication_function = get_symbolication_function_for_platform(
            first_platform, data, stacktraces
        )
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

            submit_symbolicate(
                SymbolicatorTaskKind(
                    platform=first_platform,
                    is_reprocessing=from_reprocessing,
                ),
                cache_key=cache_key,
                event_id=event_id,
                start_time=start_time,
                has_attachments=has_attachments,
                symbolicate_platforms=symbolicate_platforms,
            )
            return
        # else: go directly to process, do not go through the symbolicate queue, do not collect 200

    # NOTE: Events considered for symbolication always go through `do_process_event`
    if should_symbolicate or should_process(data):
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
        SaveEventTaskKind(
            has_attachments=has_attachments,
            from_reprocessing=from_reprocessing,
        ),
        project_id=project_id,
        cache_key=cache_key,
        event_id=event_id,
        start_time=start_time,
        data=original_data,
    )


@instrumented_task(
    name="sentry.tasks.store.preprocess_event",
    queue="events.preprocess_event",
    time_limit=65,
    soft_time_limit=60,
    silo_mode=SiloMode.REGION,
)
def preprocess_event(
    cache_key: str,
    data: MutableMapping[str, Any] | None = None,
    start_time: float | None = None,
    event_id: str | None = None,
    project: Project | None = None,
    has_attachments: bool = False,
    **kwargs: Any,
) -> None:
    return _do_preprocess_event(
        cache_key=cache_key,
        data=data,
        start_time=start_time,
        event_id=event_id,
        from_reprocessing=False,
        project=project,
        has_attachments=has_attachments,
    )


@instrumented_task(
    name="sentry.tasks.store.preprocess_event_from_reprocessing",
    queue="events.reprocessing.preprocess_event",
    time_limit=65,
    soft_time_limit=60,
    silo_mode=SiloMode.REGION,
)
def preprocess_event_from_reprocessing(
    cache_key: str,
    data: MutableMapping[str, Any] | None = None,
    start_time: float | None = None,
    event_id: str | None = None,
    project: Project | None = None,
    **kwargs: Any,
) -> None:
    return _do_preprocess_event(
        cache_key=cache_key,
        data=data,
        start_time=start_time,
        event_id=event_id,
        from_reprocessing=True,
        project=project,
    )


def is_process_disabled(project_id: int, event_id: str, platform: str) -> bool:
    if killswitch_matches_context(
        "store.load-shed-process-event-projects",
        {
            "project_id": project_id,
            "event_id": event_id,
            "platform": platform,
        },
    ):
        return True

    process_project_rollout = options.get("store.load-shed-process-event-projects-gradual")
    rollout_rate = process_project_rollout.get(project_id)
    if not rollout_rate:
        return False

    return random.random() < rollout_rate


@sentry_sdk.tracing.trace
def normalize_event(data: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
    normalizer = StoreNormalizer(
        remove_other=False,
        is_renormalize=True,
        json_dumps=orjson.dumps,
        **DEFAULT_STORE_NORMALIZER_ARGS,
    )
    return normalizer.normalize_event(dict(data), json_loads=orjson.loads)


def do_process_event(
    cache_key: str,
    start_time: float | None,
    event_id: str | None,
    from_reprocessing: bool,
    data: MutableMapping[str, Any] | None = None,
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

    project_id = data["project"]
    set_current_event_project(project_id)

    data_event_id = data["event_id"]

    def _continue_to_save_event() -> None:
        task_kind = SaveEventTaskKind(
            from_reprocessing=from_reprocessing,
            has_attachments=has_attachments,
        )
        submit_save_event(
            task_kind,
            project_id=project_id,
            cache_key=cache_key,
            event_id=data_event_id,
            start_time=start_time,
            data=data,
        )

    if is_process_disabled(project_id, data_event_id, data.get("platform") or "null"):
        return _continue_to_save_event()

    # NOTE: This span ranges in the 1-2ms range.
    with sentry_sdk.start_span(op="tasks.store.process_event.get_project_from_cache"):
        project = Project.objects.get_from_cache(id=project_id)

    project.set_cached_field_value(
        "organization", Organization.objects.get_from_cache(id=project.organization_id)
    )

    has_changed = data_has_changed

    # Stacktrace based event processors.
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
    if has_changed:
        new_data = safe_execute(scrub_data, project=project, event=data)

        # XXX(markus): When datascrubbing is finally "totally stable", we might want
        # to drop the event if it crashes to avoid saving PII
        if new_data is not None:
            data = new_data

    # TODO(dcramer): ideally we would know if data changed by default
    # Default event processors.
    for plugin in plugins.all(version=2):
        with sentry_sdk.start_span(op="task.store.process_event.preprocessors") as span:
            span.set_data("plugin", plugin.slug)
            span.set_data("from_symbolicate", from_symbolicate)
            processors = safe_execute(plugin.get_event_preprocessors, data=data)
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
    if not isinstance(data, dict):
        data = dict(data.items())

    if has_changed:
        # Run some of normalization again such that we don't:
        # - persist e.g. incredibly large stacktraces from minidumps
        # - store event timestamps that are older than our retention window
        #   (also happening with minidumps)
        data = normalize_event(data)
        cache_key = processing.event_processing_store.store(data)

    return _continue_to_save_event()


@instrumented_task(
    name="sentry.tasks.store.process_event",
    queue="events.process_event",
    time_limit=65,
    soft_time_limit=60,
    silo_mode=SiloMode.REGION,
)
def process_event(
    cache_key: str,
    start_time: float | None = None,
    event_id: str | None = None,
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
        from_reprocessing=False,
        data_has_changed=data_has_changed,
        from_symbolicate=from_symbolicate,
        has_attachments=has_attachments,
    )


@instrumented_task(
    name="sentry.tasks.store.process_event_from_reprocessing",
    queue="events.reprocessing.process_event",
    time_limit=65,
    soft_time_limit=60,
    silo_mode=SiloMode.REGION,
)
def process_event_from_reprocessing(
    cache_key: str,
    start_time: float | None = None,
    event_id: str | None = None,
    data_has_changed: bool = False,
    from_symbolicate: bool = False,
    has_attachments: bool = False,
    **kwargs: Any,
) -> None:
    return do_process_event(
        cache_key=cache_key,
        start_time=start_time,
        event_id=event_id,
        from_reprocessing=True,
        data_has_changed=data_has_changed,
        from_symbolicate=from_symbolicate,
        has_attachments=has_attachments,
    )


def _do_save_event(
    cache_key: str | None = None,
    data: MutableMapping[str, Any] | None = None,
    start_time: float | None = None,
    event_id: str | None = None,
    project_id: int | None = None,
    has_attachments: bool = False,
    consumer_type: str | None = None,
    **kwargs: Any,
) -> None:
    """
    Saves an event to the database.
    """

    set_current_event_project(project_id)

    from sentry.event_manager import EventManager
    from sentry.exceptions import HashDiscarded

    event_type = "none"

    if consumer_type and consumer_type == ConsumerType.Transactions:
        processing_store = processing.transaction_processing_store
    else:
        processing_store = processing.event_processing_store

    if cache_key and data is None:
        data = processing_store.get(cache_key)
        if data is not None:
            event_type = data.get("type") or "none"

    with metrics.global_tags(event_type=event_type):
        if event_id is None and data is not None:
            event_id = data["event_id"]

        # only when we come from reprocessing we get a project_id sent into
        # the task.
        if project_id is None:
            assert data is not None
            project_id = data.pop("project")
            set_current_event_project(project_id)

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

            manager = EventManager(data)
            # event.project.organization is populated after this statement.
            manager.save(
                project_id,
                assume_normalized=True,
                start_time=start_time,
                cache_key=cache_key,
                has_attachments=has_attachments,
            )
            # Put the updated event back into the cache so that post_process
            # has the most recent data.
            data = manager.get_data()
            if not isinstance(data, dict):
                data = dict(data.items())
            processing_store.store(data)
        except HashDiscarded:
            # Delete the event payload from cache since it won't show up in post-processing.
            if cache_key:
                processing_store.delete_by_key(cache_key)
        except Exception:
            metrics.incr("events.save_event.exception", tags={"event_type": event_type})
            raise

        finally:
            if (
                consumer_type == ConsumerType.Transactions
                and event_id
                and in_rollout_group("transactions.do_post_process_in_save", event_id)
            ):
                # we won't use the transaction data in post_process
                # so we can delete it from the cache now.
                if cache_key:
                    processing_store.delete_by_key(cache_key)
                    track_sampled_event(
                        data["event_id"],
                        ConsumerType.Transactions,
                        TransactionStageStatus.REDIS_DELETED,
                    )

            reprocessing2.mark_event_reprocessed(data)
            if cache_key and has_attachments:
                attachment_cache.delete(cache_key)

            if start_time:
                metrics.timing(
                    "events.time-to-process",
                    time() - start_time,
                    instance=data["platform"],
                    tags={
                        "is_reprocessing2": (
                            "true" if reprocessing2.is_reprocessed_event(data) else "false"
                        ),
                    },
                )


@instrumented_task(
    name="sentry.tasks.store.save_event",
    queue="events.save_event",
    time_limit=65,
    soft_time_limit=60,
    silo_mode=SiloMode.REGION,
)
def save_event(
    cache_key: str | None = None,
    data: MutableMapping[str, Any] | None = None,
    start_time: float | None = None,
    event_id: str | None = None,
    project_id: int | None = None,
    **kwargs: Any,
) -> None:
    _do_save_event(
        cache_key,
        data,
        start_time,
        event_id,
        project_id,
        consumer_type=ConsumerType.Events,
        **kwargs,
    )


@instrumented_task(
    name="sentry.tasks.store.save_event_transaction",
    time_limit=65,
    soft_time_limit=60,
    silo_mode=SiloMode.REGION,
)
def save_event_transaction(
    cache_key: str | None = None,
    data: MutableMapping[str, Any] | None = None,
    start_time: float | None = None,
    event_id: str | None = None,
    project_id: int | None = None,
    **kwargs: Any,
) -> None:
    if event_id:
        track_sampled_event(
            event_id, ConsumerType.Transactions, TransactionStageStatus.SAVE_TXN_STARTED
        )
    _do_save_event(
        cache_key,
        data,
        start_time,
        event_id,
        project_id,
        consumer_type=ConsumerType.Transactions,
        **kwargs,
    )
    if event_id:
        track_sampled_event(
            event_id, ConsumerType.Transactions, TransactionStageStatus.SAVE_TXN_FINISHED
        )


@instrumented_task(
    name="sentry.tasks.store.save_event_feedback",
    time_limit=65,
    soft_time_limit=60,
    silo_mode=SiloMode.REGION,
)
def save_event_feedback(
    cache_key: str | None = None,
    start_time: float | None = None,
    event_id: str | None = None,
    *,
    data: Mapping[str, Any],
    project_id: int,
    **kwargs: Any,
) -> None:
    create_feedback_issue(data, project_id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)


@instrumented_task(
    name="sentry.tasks.store.save_event_attachments",
    queue="events.save_event_attachments",
    time_limit=65,
    soft_time_limit=60,
    silo_mode=SiloMode.REGION,
)
def save_event_attachments(
    cache_key: str | None = None,
    data: MutableMapping[str, Any] | None = None,
    start_time: float | None = None,
    event_id: str | None = None,
    project_id: int | None = None,
    **kwargs: Any,
) -> None:
    _do_save_event(
        cache_key,
        data,
        start_time,
        event_id,
        project_id,
        consumer_type=ConsumerType.Attachments,
        has_attachments=True,
        **kwargs,
    )
