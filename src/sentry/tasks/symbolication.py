import logging
from collections.abc import Callable, Mapping
from time import time
from typing import Any

import sentry_sdk
from django.conf import settings

from sentry.eventstore import processing
from sentry.eventstore.processing.base import Event
from sentry.killswitches import killswitch_matches_context
from sentry.lang.javascript.processing import process_js_stacktraces
from sentry.lang.native.processing import get_native_symbolication_function
from sentry.lang.native.symbolicator import Symbolicator, SymbolicatorPlatform, SymbolicatorTaskKind
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.stacktraces.processing import StacktraceInfo, find_stacktraces_in_data
from sentry.tasks import store
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics
from sentry.utils.sdk import set_current_event_project

error_logger = logging.getLogger("sentry.errors.events")
info_logger = logging.getLogger("sentry.symbolication")


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

    from sentry.lang.java.utils import is_jvm_event
    from sentry.lang.javascript.utils import is_js_event

    platforms = []

    if is_jvm_event(data, stacktraces):
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
    start_time: float | None,
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

    event_id = str(data["event_id"])
    project_id = data["project"]
    has_changed = False

    set_current_event_project(project_id)

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
        stacktraces = find_stacktraces_in_data(data)
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

    project = Project.objects.get_from_cache(id=project_id)
    org = project.organization
    # needed for efficient featureflag checks in getsentry
    # NOTE: The `organization` is used for constructing the symbol sources.
    with sentry_sdk.start_span(op="lang.native.symbolicator.organization.get_from_cache"):
        project.set_cached_field_value(
            "organization", Organization.objects.get_from_cache(id=project.organization_id)
        )

    def on_symbolicator_request():
        duration = time() - symbolication_start_time
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
        org=org,
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
    if not isinstance(data, dict):
        data = dict(data.items())

    if has_changed:
        cache_key = processing.event_processing_store.store(data)

    return _continue_to_process_event()


# ============ Parameterized tasks below ============
# We have different *tasks* and associated *queues* for the following permutations:
# - Event Type (JS vs Native)
# - Reprocessing (currently not available for JS events)


def submit_symbolicate(
    task_kind: SymbolicatorTaskKind,
    cache_key: str,
    event_id: str | None,
    start_time: float | None,
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
        start_time: float | None = None,
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
    task_kind=SymbolicatorTaskKind(platform=SymbolicatorPlatform.native, is_reprocessing=False),
)
symbolicate_js_event = make_task_fn(
    name="sentry.tasks.symbolicate_js_event",
    queue="events.symbolicate_js_event",
    task_kind=SymbolicatorTaskKind(platform=SymbolicatorPlatform.js, is_reprocessing=False),
)
symbolicate_jvm_event = make_task_fn(
    name="sentry.tasks.symbolicate_jvm_event",
    queue="events.symbolicate_jvm_event",
    task_kind=SymbolicatorTaskKind(platform=SymbolicatorPlatform.jvm, is_reprocessing=False),
)


# Reprocessing variants, only for "native" events:
symbolicate_event_from_reprocessing = make_task_fn(
    name="sentry.tasks.store.symbolicate_event_from_reprocessing",
    queue="events.reprocessing.symbolicate_event",
    task_kind=SymbolicatorTaskKind(platform=SymbolicatorPlatform.native, is_reprocessing=True),
)
