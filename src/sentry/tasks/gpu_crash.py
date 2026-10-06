"""Isolated GPU crash dump symbolication task.

``preprocess_event`` routes GPU events here — a dedicated ``gpu.crash_dump``
namespace, so a slow/down teapot can't back up CPU symbolication. Runs teapot,
applies the decode, and hands the event to the normal save pipeline. Best-effort:
any failure still saves the event (unenriched) via ``submit_process``.
"""

from __future__ import annotations

import logging
from collections.abc import MutableMapping
from typing import Any

import sentry_sdk

from sentry import options
from sentry.killswitches import killswitch_matches_context
from sentry.lang.native.gpu import apply_gpu_crash_symbolication
from sentry.lang.native.teapot import TeapotUnavailable, submit_to_teapot
from sentry.lang.native.utils import (
    find_all_shader_debug_attachments,
    find_gpu_crash_dump_attachment,
)
from sentry.models.project import Project
from sentry.services.eventstore import processing
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


@instrumented_task(
    name="sentry.tasks.symbolicate_gpu_crash_event",
    namespace=gpu_crash_dump_tasks,
    processing_deadline_duration=120,
    silo_mode=SiloMode.CELL,
)
def symbolicate_gpu_crash_event(
    cache_key: str,
    start_time: float | None = None,
    event_id: str | None = None,
    data: MutableMapping[str, Any] | None = None,
    has_attachments: bool = False,
    from_reprocessing: bool = False,
    **kwargs: Any,
) -> None:
    """Run teapot over the event's ``.nv-gpudmp`` and apply the decode, pre-save."""
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


def _try_symbolicate(data: MutableMapping[str, Any], project_id: int, event_id: str) -> bool:
    """Best-effort teapot symbolication; returns whether ``data`` was enriched.

    All failures are swallowed — teapot must never block the save. The kill
    switch is re-checked here so ops can halt already-queued work (the feature
    flag is gated at routing time, where the project is already loaded).
    """
    try:
        if not options.get("teapot.enabled"):
            metrics.incr("tasks.gpu_crash.skipped", tags={"reason": "disabled"})
            return False

        # Re-check the load-shed killswitch (routing only gates new events) so ops
        # can drain already-queued work when the pool is overwhelmed.
        if killswitch_matches_context(
            "store.load-shed-gpu-crash-projects",
            {
                "project_id": project_id,
                "event_id": event_id,
                "platform": data.get("platform") or "null",
            },
        ):
            metrics.incr("tasks.gpu_crash.skipped", tags={"reason": "load_shed"})
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

        count = len(shaders)
        metrics.incr(
            "tasks.gpu_crash.request",
            tags={"shader_debug_count": str(count) if count < 10 else "10+"},
        )
        try:
            project = Project.objects.get_from_cache(id=project_id)
        except Project.DoesNotExist:
            # Deleted between routing and execution — routine stale ref, not an error.
            metrics.incr("tasks.gpu_crash.skipped", tags={"reason": "project_missing"})
            return False

        try:
            with metrics.timer("tasks.gpu_crash.teapot"):
                response = submit_to_teapot(project, event_id, dump, shaders)
        except TeapotUnavailable:
            # A genuine outage — feed the breaker so repeated failures trip it.
            breaker.record_error()
            metrics.incr("tasks.gpu_crash.teapot_unavailable")
            return False

        if response is None:
            # Request/data error (bad request, missing attachment): teapot is
            # healthy, so don't trip the breaker — just save unenriched.
            metrics.incr("tasks.gpu_crash.skipped", tags={"reason": "request_error"})
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
