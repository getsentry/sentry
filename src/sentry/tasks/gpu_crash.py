"""Isolated GPU crash dump symbolication task.

The GPU crash arrives from Relay as its own native event (see
``sentry.lang.native.gpu``) carrying the ``.nv-gpudmp`` attachment.
``preprocess_event`` routes such events here — a dedicated task in the
``gpu.crash_dump`` namespace, so a slow or unavailable teapot can never back up
CPU symbolication. We run teapot, apply the decode to the in-flight event, and
hand it to the normal save pipeline. Best-effort: on any failure the event is
still saved through ``submit_process``, just unenriched.
"""

from __future__ import annotations

import logging
from typing import Any

import sentry_sdk

from sentry import features, options
from sentry.silo.base import SiloMode
from sentry.tasks import store
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import gpu_crash_dump_tasks
from sentry.utils import metrics
from sentry.utils.circuit_breaker2 import CircuitBreaker, CountBasedTripStrategy
from sentry.utils.sdk import set_current_event_project

logger = logging.getLogger(__name__)

# Trips after repeated teapot failures so a teapot outage doesn't tie up the GPU
# pool: while open, tasks skip teapot and save the event unenriched (fail fast,
# no per-request timeout paid).
_CIRCUIT_BREAKER_KEY = "teapot.gpu_crash"


def _teapot_circuit_breaker() -> CircuitBreaker:
    config = options.get("teapot.circuit-breaker-config")
    return CircuitBreaker(_CIRCUIT_BREAKER_KEY, config, CountBasedTripStrategy.from_config(config))


def submit_symbolicate_gpu_crash(
    cache_key: str,
    event_id: str | None,
    start_time: float | None,
    has_attachments: bool,
    from_reprocessing: bool,
) -> None:
    """Schedule GPU crash symbolication on its dedicated queue (pre-save)."""
    symbolicate_gpu_crash_event.delay(
        cache_key=cache_key,
        start_time=start_time,
        event_id=event_id,
        has_attachments=has_attachments,
        from_reprocessing=from_reprocessing,
    )


@instrumented_task(
    name="sentry.tasks.symbolicate_gpu_crash_event",
    namespace=gpu_crash_dump_tasks,
    # Bounds how long a stuck teapot can hold a worker in the GPU pool.
    processing_deadline_duration=120,
    silo_mode=SiloMode.CELL,
)
def symbolicate_gpu_crash_event(
    cache_key: str,
    start_time: float | None = None,
    event_id: str | None = None,
    data: Any | None = None,
    has_attachments: bool = False,
    from_reprocessing: bool = False,
    **kwargs: Any,
) -> None:
    """Run teapot over the event's ``.nv-gpudmp`` and apply the decode, pre-save."""
    from sentry.services.eventstore import processing

    if data is None:
        data = processing.event_processing_store.get(cache_key)
    if data is None:
        metrics.incr("tasks.gpu_crash.skipped", tags={"reason": "cache"})
        return

    event_id = str(data["event_id"])
    project_id = data["project"]
    set_current_event_project(project_id)

    has_changed = _try_symbolicate(data, project_id, event_id)

    if not isinstance(data, dict):
        data = dict(data.items())
    if has_changed:
        cache_key = processing.event_processing_store.store(data)

    # Always continue to save — the event was ingested (and billed) by Relay.
    store.submit_process(
        from_reprocessing=from_reprocessing,
        cache_key=cache_key,
        event_id=event_id,
        start_time=start_time,
        data_has_changed=has_changed,
        from_symbolicate=True,
        has_attachments=has_attachments,
    )


def _try_symbolicate(data: Any, project_id: int, event_id: str) -> bool:
    """Best-effort teapot symbolication. Returns whether ``data`` was enriched.

    Every failure is swallowed: teapot being slow, down, or wrong must never stop
    the GPU event from saving. The kill switch and feature flag are re-checked
    here so ops can halt already-queued work.
    """
    from sentry.lang.native.gpu import apply_gpu_crash_symbolication
    from sentry.lang.native.teapot import submit_to_teapot
    from sentry.lang.native.utils import (
        find_all_shader_debug_attachments,
        find_gpu_crash_dump_attachment,
    )
    from sentry.models.project import Project

    try:
        if not options.get("teapot.enabled"):
            metrics.incr("tasks.gpu_crash.skipped", tags={"reason": "disabled"})
            return False

        project = Project.objects.get_from_cache(id=project_id)
        if not features.has("organizations:gpu-crash-symbolication", project.organization):
            metrics.incr("tasks.gpu_crash.skipped", tags={"reason": "flag_off"})
            return False

        dump = find_gpu_crash_dump_attachment(data)
        if dump is None:
            metrics.incr("tasks.gpu_crash.skipped", tags={"reason": "attachment_missing"})
            return False
        shaders = find_all_shader_debug_attachments(data)

        breaker = _teapot_circuit_breaker()
        if not breaker.should_allow_request():
            metrics.incr("tasks.gpu_crash.skipped", tags={"reason": "circuit_open"})
            return False

        metrics.incr(
            "tasks.gpu_crash.request",
            tags={"shader_debug_count": str(min(len(shaders), 10))},
        )
        with metrics.timer("tasks.gpu_crash.teapot"):
            response = submit_to_teapot(project, event_id, dump, shaders)
        if response is None:
            breaker.record_error()
            metrics.incr("tasks.gpu_crash.teapot_unavailable")
            return False
        breaker.record_success()

        applied = apply_gpu_crash_symbolication(data, response)
        metrics.incr(
            "tasks.gpu_crash.completed",
            tags={
                "symbolicated": str(applied is not None),
                "fault_category": response.get("fault_category") or "unknown",
            },
        )
        return applied is not None
    except Exception as e:
        metrics.incr("tasks.gpu_crash.error", tags={"reason": "unexpected"})
        logger.warning(
            "tasks.gpu_crash.unexpected_error", extra={"event_id": event_id, "error": repr(e)}
        )
        sentry_sdk.capture_exception(e)
        return False
