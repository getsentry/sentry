import logging
from collections.abc import Callable, Mapping
from time import time
from typing import Any

import sentry_sdk
from django.conf import settings

from sentry import options
from sentry.eventstore import processing
from sentry.eventstore.processing.base import Event
from sentry.features.rollout import in_random_rollout
from sentry.killswitches import killswitch_matches_context
from sentry.lang.javascript.processing import process_js_stacktraces
from sentry.lang.native.processing import get_native_symbolication_function
from sentry.lang.native.symbolicator import Symbolicator, SymbolicatorPlatform, SymbolicatorTaskKind
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.processing import realtime_metrics
from sentry.silo.base import SiloMode
from sentry.stacktraces.processing import StacktraceInfo, find_stacktraces_in_data
from sentry.tasks import store
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.canonical import CANONICAL_TYPES, CanonicalKeyDict
from sentry.utils.sdk import set_current_event_project

error_logger = logging.getLogger("sentry.errors.events")
info_logger = logging.getLogger("sentry.symbolication")

# The maximum number of times an event will be moved between the normal
# and low priority queues
SYMBOLICATOR_MAX_QUEUE_SWITCHES = 3


def should_demote_symbolication(
    project_id: int, lpq_projects: set[int] | None = None, emit_metrics=True
) -> bool:
    """
    Determines whether a project's symbolication events should be pushed to the low priority queue.

    The decision is made based on three factors, in order:
        1. is the store.symbolicate-event-lpq-never killswitch set for the project? -> normal queue
        2. is the store.symbolicate-event-lpq-always killswitch set for the project? -> low priority queue
        3. has the project been selected for the lpq according to realtime_metrics? -> low priority queue

    Note that 3 is gated behind the config setting SENTRY_ENABLE_AUTO_LOW_PRIORITY_QUEUE.

    If lpq projects is defined and the auto low priority queue is enabled, this function
    will avoid making additional Redis calls for performance reasons.
    """
    never_lowpri = killswitch_matches_context(
        "store.symbolicate-event-lpq-never",
        {
            "project_id": project_id,
        },
        emit_metrics=emit_metrics,
    )

    if never_lowpri:
        return False

    always_lowpri = killswitch_matches_context(
        "store.symbolicate-event-lpq-always",
        {
            "project_id": project_id,
        },
        emit_metrics=emit_metrics,
    )

    if always_lowpri:
        return True
    elif settings.SENTRY_ENABLE_AUTO_LOW_PRIORITY_QUEUE:
        try:
            if lpq_projects:
                return project_id in lpq_projects
            else:
                return realtime_metrics.is_lpq_project(project_id)
        # realtime_metrics is empty in getsentry
        except AttributeError:
            return False
    else:
        return False


def get_symbolication_function_for_platform(
    platform: SymbolicatorPlatform,
    data: Mapping[str, Any],
    stacktraces: list[StacktraceInfo],
) -> Callable[[Symbolicator, Any], Any]:
    """Returns the symbolication function for the given platform
    and event data."""

    from sentry.lang.java.processing import process_jvm_stacktraces

    if platform == SymbolicatorPlatform.js:
        return process_js_stacktraces
    elif platform == SymbolicatorPlatform.jvm:
        return process_jvm_stacktraces
    else:
        symbolication_function = get_native_symbolication_function(data, stacktraces)
        # get_native_symbolication_function already returned something in
        # get_symbolication_platforms
        assert symbolication_function is not None
        return symbolication_function


def get_symbolication_platforms(
    data: Mapping[str, Any], stacktraces: list[StacktraceInfo]
) -> list[SymbolicatorPlatform]:
    """Returns a list of Symbolicator platforms
    that apply to this event."""

    from sentry.lang.java.utils import is_jvm_event, should_use_symbolicator_for_proguard
    from sentry.lang.javascript.utils import is_js_event

    platforms = []

    if should_use_symbolicator_for_proguard(int(data["project"])) and is_jvm_event(
        data, stacktraces
    ):
        platforms.append(SymbolicatorPlatform.jvm)
    if is_js_event(data, stacktraces):
        platforms.append(SymbolicatorPlatform.js)
    if get_native_symbolication_function(data, stacktraces) is not None:
        platforms.append(SymbolicatorPlatform.native)

    return platforms


class SymbolicationTimeout(Exception):
    pass


def _do_symbolicate_event(
    task_kind: SymbolicatorTaskKind,
    cache_key: str,
    start_time: int | None,
    event_id: str | None,
    data: Event | None = None,
    queue_switches: int = 0,
    has_attachments: bool = False,
    symbolicate_platforms: list[SymbolicatorPlatform] | None = None,
) -> None:
    if data is None:
        data = processing.event_processing_store.get(cache_key)

    if data is None:
        metrics.incr(
            "events.failed", tags={"reason": "cache", "stage": "symbolicate"}, skip_internal=False
        )
        error_logger.error("symbolicate.failed.empty", extra={"cache_key": cache_key})
        return

    data = CanonicalKeyDict(data)
    event_id = str(data["event_id"])
    project_id = data["project"]
    has_changed = False

    stacktraces = find_stacktraces_in_data(data)

    # Backwards compatibility: If the current platform is JS, we may need to do
    # native afterwards. Otherwise we don't do anything.
    if symbolicate_platforms is None:
        if (
            task_kind.platform == SymbolicatorPlatform.js
            and get_native_symbolication_function(data, stacktraces) is not None
        ):
            symbolicate_platforms = [SymbolicatorPlatform.native]
        else:
            symbolicate_platforms = []

    set_current_event_project(project_id)

    # check whether the event is in the wrong queue and if so, move it to the other one.
    # we do this at most SYMBOLICATOR_MAX_QUEUE_SWITCHES times.
    if queue_switches >= SYMBOLICATOR_MAX_QUEUE_SWITCHES:
        metrics.incr("tasks.store.symbolicate_event.low_priority.max_queue_switches", sample_rate=1)
    else:
        should_be_low_priority = should_demote_symbolication(project_id)

        if task_kind.is_low_priority != should_be_low_priority:
            metrics.incr("tasks.store.symbolicate_event.low_priority.wrong_queue", sample_rate=1)
            submit_symbolicate(
                task_kind.with_low_priority(should_be_low_priority),
                cache_key,
                event_id,
                start_time,
                queue_switches + 1,
                has_attachments=has_attachments,
            )
            return

    def _continue_to_process_event(was_killswitched: bool = False) -> None:
        # Go through the remaining symbolication platforms
        # and submit the next one.
        if not was_killswitched and symbolicate_platforms:
            next_platform = symbolicate_platforms.pop(0)

            submit_symbolicate(
                task_kind=task_kind.with_platform(next_platform),
                cache_key=cache_key,
                event_id=event_id,
                start_time=start_time,
                has_attachments=has_attachments,
                symbolicate_platforms=symbolicate_platforms,
            )
            return
        # else:
        store.submit_process(
            from_reprocessing=task_kind.is_reprocessing,
            cache_key=cache_key,
            event_id=event_id,
            start_time=start_time,
            data_has_changed=has_changed,
            from_symbolicate=True,
            has_attachments=has_attachments,
        )

    try:
        symbolication_function = get_symbolication_function_for_platform(
            task_kind.platform, data, stacktraces
        )
    except AssertionError:
        symbolication_function = None

    symbolication_function_name = getattr(symbolication_function, "__name__", "none")

    if symbolication_function is None or killswitch_matches_context(
        "store.load-shed-symbolicate-event-projects",
        {
            "project_id": project_id,
            "event_id": event_id,
            "platform": data.get("platform") or "null",
            "symbolication_function": symbolication_function_name,
        },
    ):
        return _continue_to_process_event(True)

    symbolication_start_time = time()

    def record_symbolication_duration() -> float:
        """
        Returns the symbolication duration so far, and optionally record the duration to the LPQ metrics if configured.
        """
        symbolication_duration = time() - symbolication_start_time

        # we throw the dice on each record operation, otherwise an unlucky extremely slow event would never count
        # towards the budget.
        submit_realtime_metrics = in_random_rollout(
            "symbolicate-event.low-priority.metrics.submission-rate"
        )
        if submit_realtime_metrics:
            with sentry_sdk.start_span(op="tasks.store.symbolicate_event.low_priority.metrics"):
                submission_ratio = options.get(
                    "symbolicate-event.low-priority.metrics.submission-rate"
                )
                try:
                    # we adjust the duration according to the `submission_ratio` so that the budgeting works
                    # the same even considering sampling of metrics.
                    recorded_duration = symbolication_duration / submission_ratio
                    realtime_metrics.record_project_duration(project_id, recorded_duration)
                except Exception as e:
                    sentry_sdk.capture_exception(e)
        return symbolication_duration

    project = Project.objects.get_from_cache(id=project_id)
    # needed for efficient featureflag checks in getsentry
    # NOTE: The `organization` is used for constructing the symbol sources.
    with sentry_sdk.start_span(op="lang.native.symbolicator.organization.get_from_cache"):
        project.set_cached_field_value(
            "organization", Organization.objects.get_from_cache(id=project.organization_id)
        )

    def on_symbolicator_request():
        duration = record_symbolication_duration()
        if duration > settings.SYMBOLICATOR_PROCESS_EVENT_HARD_TIMEOUT:
            raise SymbolicationTimeout
        elif duration > settings.SYMBOLICATOR_PROCESS_EVENT_WARN_TIMEOUT:
            error_logger.warning(
                "symbolicate.slow",
                extra={"project_id": project_id, "event_id": event_id},
            )

    symbolicator = Symbolicator(
        task_kind=task_kind,
        on_request=on_symbolicator_request,
        project=project,
        event_id=event_id,
    )

    with (
        metrics.timer(
            "tasks.store.symbolicate_event.symbolication",
            tags={"symbolication_function": symbolication_function_name},
        ),
        sentry_sdk.start_span(
            op=f"tasks.store.symbolicate_event.{symbolication_function_name}"
        ) as span,
    ):
        try:
            symbolicated_data = symbolication_function(symbolicator, data)
            span.set_data("symbolicated_data", bool(symbolicated_data))

            if symbolicated_data:
                data = symbolicated_data
                has_changed = True
        except SymbolicationTimeout:
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

    # We cannot persist canonical types in the cache, so we need to
    # downgrade this.
    if isinstance(data, CANONICAL_TYPES):
        data = dict(data.items())

    if has_changed:
        cache_key = processing.event_processing_store.store(data)

    return _continue_to_process_event()


# ============ Parameterized tasks below ============
# We have different *tasks* and associated *queues* for the following permutations:
# - Event Type (JS vs Native)
# - Queue Type (LPQ vs normal)
# - Reprocessing (currently not available for JS events)


def submit_symbolicate(
    task_kind: SymbolicatorTaskKind,
    cache_key: str,
    event_id: str | None,
    start_time: int | None,
    queue_switches: int = 0,
    has_attachments: bool = False,
    symbolicate_platforms: list[SymbolicatorPlatform] | None = None,
) -> None:
    # Because of `mock` usage, we cannot just save a reference to the actual function
    # into the `TASK_FNS` dict. We actually have to access it at runtime from the global scope
    # on every invocation. Great stuff!
    task_fn_name = TASK_FNS.get(task_kind, "symbolicate_event")
    task_fn = globals()[task_fn_name]

    # Pass symbolicate_platforms as strings—apparently we're not allowed to pickle
    # custom classes.
    symbolicate_platform_names = (
        None if symbolicate_platforms is None else [p.name for p in symbolicate_platforms]
    )

    task_fn.delay(
        cache_key=cache_key,
        start_time=start_time,
        event_id=event_id,
        queue_switches=queue_switches,
        has_attachments=has_attachments,
        symbolicate_platforms=symbolicate_platform_names,
    )


SymbolicationTaskFn = Any  # FIXME: it would be nice if `instrumented_task` would be fully typed
# Maps from the `SymbolicatorTaskKind` to the name of the specific task function in the global scope.
TASK_FNS: dict[SymbolicatorTaskKind, str] = {}


def make_task_fn(name: str, queue: str, task_kind: SymbolicatorTaskKind) -> SymbolicationTaskFn:
    """
    Returns a parameterized version of `_do_symbolicate_event` that runs as a Celery task,
    and can be spawned as one.
    """

    @instrumented_task(
        name=name,
        queue=queue,
        time_limit=settings.SYMBOLICATOR_PROCESS_EVENT_HARD_TIMEOUT + 30,
        soft_time_limit=settings.SYMBOLICATOR_PROCESS_EVENT_HARD_TIMEOUT + 20,
        acks_late=True,
        silo_mode=SiloMode.REGION,
    )
    def symbolication_fn(
        cache_key: str,
        start_time: int | None = None,
        event_id: str | None = None,
        data: Event | None = None,
        queue_switches: int = 0,
        has_attachments: bool = False,
        symbolicate_platforms: list[str] | None = None,
        **kwargs: Any,
    ) -> None:
        """
        Handles event symbolication using the external service: symbolicator.

        :param string cache_key: the cache key for the event data
        :param int start_time: the timestamp when the event was ingested
        :param string event_id: the event identifier
        """

        # Turn symbolicate_platforms back into proper enum values
        symbolicate_platform_values = (
            None
            if symbolicate_platforms is None
            else [SymbolicatorPlatform(p) for p in symbolicate_platforms]
        )
        return _do_symbolicate_event(
            task_kind=task_kind,
            cache_key=cache_key,
            start_time=start_time,
            event_id=event_id,
            data=data,
            queue_switches=queue_switches,
            has_attachments=has_attachments,
            symbolicate_platforms=symbolicate_platform_values,
        )

    fn_name = name.split(".")[-1]
    symbolication_fn.__name__ = fn_name
    TASK_FNS[task_kind] = fn_name

    return symbolication_fn


# The names of tasks and metrics in this file point to tasks.store instead of tasks.symbolicator
# for legacy reasons, namely to prevent celery from dropping older tasks and needing to
# update metrics tooling (e.g. DataDog). All (as of 19/10/2021) of these tasks were moved
# out of tasks/store.py, hence the "store" bit of the name.
#
# New tasks and metrics are welcome to use the correct naming scheme as they are not
# burdened by aforementioned legacy concerns.

symbolicate_event = make_task_fn(
    name="sentry.tasks.store.symbolicate_event",
    queue="events.symbolicate_event",
    task_kind=SymbolicatorTaskKind(
        platform=SymbolicatorPlatform.native, is_low_priority=False, is_reprocessing=False
    ),
)
symbolicate_js_event = make_task_fn(
    name="sentry.tasks.symbolicate_js_event",
    queue="events.symbolicate_js_event",
    task_kind=SymbolicatorTaskKind(
        platform=SymbolicatorPlatform.js, is_low_priority=False, is_reprocessing=False
    ),
)
symbolicate_jvm_event = make_task_fn(
    name="sentry.tasks.symbolicate_jvm_event",
    # NOTE: Intentionally uses the same queue as `symbolicate_event`.
    queue="events.symbolicate_event",
    task_kind=SymbolicatorTaskKind(
        platform=SymbolicatorPlatform.jvm, is_low_priority=False, is_reprocessing=False
    ),
)

# LPQ variants:
symbolicate_event_low_priority = make_task_fn(
    name="sentry.tasks.store.symbolicate_event_low_priority",
    queue="events.symbolicate_event_low_priority",
    task_kind=SymbolicatorTaskKind(
        platform=SymbolicatorPlatform.native, is_low_priority=True, is_reprocessing=False
    ),
)
symbolicate_js_event_low_priority = make_task_fn(
    name="sentry.tasks.symbolicate_js_event_low_priority",
    queue="events.symbolicate_js_event_low_priority",
    task_kind=SymbolicatorTaskKind(
        platform=SymbolicatorPlatform.js, is_low_priority=True, is_reprocessing=False
    ),
)
symbolicate_jvm_event_low_priority = make_task_fn(
    name="sentry.tasks.symbolicate_jvm_event_low_priority",
    # NOTE: Intentionally uses the same queue as `symbolicate_event_low_priority`.
    queue="events.symbolicate_event_low_priority",
    task_kind=SymbolicatorTaskKind(
        platform=SymbolicatorPlatform.jvm, is_low_priority=True, is_reprocessing=False
    ),
)

# Reprocessing variants, only for "native" events:
symbolicate_event_from_reprocessing = make_task_fn(
    name="sentry.tasks.store.symbolicate_event_from_reprocessing",
    queue="events.reprocessing.symbolicate_event",
    task_kind=SymbolicatorTaskKind(
        platform=SymbolicatorPlatform.native, is_low_priority=False, is_reprocessing=True
    ),
)
symbolicate_event_from_reprocessing_low_priority = make_task_fn(
    name="sentry.tasks.store.symbolicate_event_from_reprocessing_low_priority",
    queue="events.reprocessing.symbolicate_event_low_priority",
    task_kind=SymbolicatorTaskKind(
        platform=SymbolicatorPlatform.native, is_low_priority=True, is_reprocessing=True
    ),
)
