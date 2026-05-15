"""GPU crash dump enrichment — teapot response → Sentry event.

Self-contained module that owns everything specific to the GPU crash flow:

* attachment-type detection (`find_gpu_crash_dump_attachment` +
  `find_all_shader_debug_attachments` in utils)
* the HTTP call-out to teapot (in `teapot.py`)
* merging the response into `contexts.gpu_crash`
* minting a separate GPU event + producing the secondary IssueOccurrence
* surfacing teapot's category / title / fingerprint / markers verbatim
  so grouping stays consistent with teapot's own crash-shape model.

`processing.py` keeps the minidump / Apple / native-stacktrace CPU paths and
just re-exports `process_gpu_crash_dump` / `GPU_CRASH_DUMP_ATTACHMENT_TYPE`
for backward compatibility with existing imports.
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

import sentry_sdk

from sentry.utils import metrics
from sentry.utils.safe import set_path

logger = logging.getLogger(__name__)

# Attachment type used for NVIDIA Aftermath GPU crash dumps. Processed by
# teapot (sibling service to Symbolicator).
GPU_CRASH_DUMP_ATTACHMENT_TYPE = "event.nv_gpudmp"


# ─────────────────────────── public entry point ────────────────────────────


def process_gpu_crash_dump(data: Any, project: Any, event_id: str) -> Any:
    """Enrich ``data`` with GPU crash symbolication from teapot, if available.

    Safe to call on events that don't carry a GPU dump — returns unchanged.
    Teapot being unavailable or erroring never fails the primary event.
    When teapot returns a decoded dump, this also produces a secondary
    `IssueOccurrence` — a distinct issue grouped by teapot's
    `fault_category` + `fingerprint`, referencing the same `trace_id` as
    the CPU issue via a fresh GPU event.
    """

    # Deferred imports: avoids importing `requests` and the issue platform
    # at module import time for processes that don't touch this path.
    from sentry.lang.native.teapot import submit_to_teapot
    from sentry.lang.native.utils import (
        find_all_shader_debug_attachments,
        find_gpu_crash_dump_attachment,
    )

    dump = find_gpu_crash_dump_attachment(data)
    if not dump:
        return data

    # Discover every `.nvdbg` attachment too. Customer SDKs ship one per
    # active shader involved in the crash; teapot needs them by uid to
    # populate `Active Warps[].Shader mapping` (which is what gives us
    # filename + line in the rendered frame).
    shader_debug_info = find_all_shader_debug_attachments(data)

    metrics.incr(
        "process.gpu.symbolicate.request",
        tags={"shader_debug_count": str(min(len(shader_debug_info), 10))},
    )
    response = submit_to_teapot(project, event_id, dump, shader_debug_info)
    if response is None:
        metrics.incr("process.gpu.symbolicate.skipped")
        return data

    _merge_gpu_response(data, response)
    metrics.incr(
        "process.gpu.symbolicate.completed",
        tags={
            "status": response.get("status") or "unknown",
            "fault_category": response.get("fault_category") or "unknown",
        },
    )

    # Produce a secondary issue for actionable dumps. `failed` means teapot
    # couldn't decode — no useful fingerprint, so no second issue.
    status = response.get("status")
    if status in ("completed", "partial"):
        try:
            _produce_gpu_occurrence(data, project, event_id, response)
            logger.warning("teapot.gpu_occurrence.emitted event_id=%s", event_id)
        except Exception as e:
            metrics.incr("process.gpu.occurrence.error")
            logger.warning("teapot.gpu_occurrence.failed event_id=%s err=%s", event_id, repr(e))
            sentry_sdk.capture_exception(e)

    return data


# ─────────────────────────── response merging ─────────────────────────────


def _build_flat_gpu_context(response: Mapping[str, Any]) -> dict[str, Any]:
    """Flatten teapot's response into a UI-friendly ``contexts.gpu_crash`` dict.

    Sentry's context renderer surfaces top-level scalars directly but
    collapses nested objects under ``> { N items }``. Flattening the
    fault / gpu_state into scalar fields means every useful value shows
    up without the user having to expand. The full nested blobs live on
    ``contexts.gpu_crash_raw`` for deep debugging.

    Shared between ``_merge_gpu_response`` (enriches the CPU event) and
    ``_produce_gpu_occurrence`` (builds the dedicated GPU event) so both
    produce the same shape.
    """

    fault = response.get("fault") or {}
    gpu_state = response.get("gpu_state") or {}
    shader_context = response.get("shader_context") or {}
    active_shaders = shader_context.get("active_shaders") or []
    primary_shader = active_shaders[0] if active_shaders else {}

    flat: dict[str, Any] = {
        "type": "gpu_crash",
        "status": response.get("status"),
        # Top-level teapot fields — drive grouping + UX. Always populated
        # in successful responses; missing only for `failed` ones.
        "fault_category": response.get("fault_category"),
        "title": response.get("title"),
        "handler": response.get("handler"),
        "sdk_version": response.get("sdk_version"),
        "decode_time_ms": response.get("decode_time_ms"),
        # Fault
        "fault_type": fault.get("type"),
        "fault_description": fault.get("description"),
        "fault_code": fault.get("code"),
        "virtual_address": fault.get("virtual_address"),
        "access_type": fault.get("access_type"),
        # GPU / host
        "device_name": gpu_state.get("device_name"),
        "device_status": gpu_state.get("device_status"),
        "driver_version": gpu_state.get("driver_version"),
        "graphics_api": gpu_state.get("api"),
        "os_version": gpu_state.get("os_version"),
        "application_name": gpu_state.get("application_name"),
        "engine_reset": gpu_state.get("engine_reset"),
        "adapter_reset": gpu_state.get("adapter_reset"),
        # Shader (when present)
        "shader_hash": primary_shader.get("shader_hash"),
        "shader_type": primary_shader.get("shader_type"),
        "shader_debug_info_uid": primary_shader.get("shader_debug_info_uid"),
        # Missing debug files (surface count so users see when they need
        # to fix their SDK integration).
        "missing_dif_count": len(response.get("missing_difs") or []),
    }
    warnings = response.get("warnings") or []
    if warnings:
        flat["warnings"] = warnings
    return {k: v for k, v in flat.items() if v is not None}


def _build_gpu_raw_context(response: Mapping[str, Any]) -> dict[str, Any]:
    """Keep the full nested teapot response for deep debugging on the event."""

    return {
        "type": "default",
        "fault": response.get("fault") or {},
        "gpu_state": response.get("gpu_state") or {},
        "shader_context": response.get("shader_context") or {},
        "missing_difs": response.get("missing_difs") or [],
        "markers": response.get("markers") or [],
    }


def _merge_gpu_response(data: Any, response: Mapping[str, Any]) -> None:
    """Write teapot's response into the event's gpu_crash context.

    Never mutates the primary exception, debug_meta images, or trace context —
    GPU symbolication is additive enrichment. Frames + markers for the
    secondary IssueOccurrence are stashed privately on
    ``data["_gpu_crash_private"]`` and never land in the user-visible event.
    """

    status = response.get("status")
    if status == "failed":
        set_path(
            data,
            "contexts",
            "gpu_crash",
            value={
                "type": "gpu_crash",
                "status": "failed",
                "error": response.get("error", {}),
                "handler": response.get("handler"),
            },
        )
        return

    set_path(data, "contexts", "gpu_crash", value=_build_flat_gpu_context(response))
    set_path(data, "contexts", "gpu_crash_raw", value=_build_gpu_raw_context(response))

    # Private channel: picked up by the occurrence producer. Not
    # persisted into Snuba / not shown in the UI.
    private: dict[str, Any] = {}
    frames = response.get("frames") or []
    if frames:
        private["frames"] = frames
    markers = response.get("markers") or []
    if markers:
        private["markers"] = markers
    if private:
        data["_gpu_crash_private"] = private


# ─────────────────────────── detector wiring ──────────────────────────────


def _get_or_create_gpu_detector_id(project: Any) -> int | None:
    """Return the Detector id that issue-platform associates GPU crash groups with.

    Without a real Detector row, `associate_new_group_with_detector` (at
    src/sentry/workflow_engine/processors/detector.py) emits a WARN for
    every new GPU group and skips the DetectorGroup link. Providing one
    via `occurrence.evidence_data["detector_id"]` is picked up by
    `save_issue_from_occurrence` (src/sentry/issues/ingest.py).

    Detectors are cheap — one row per (project, type) — and `get_or_create`
    keeps this idempotent. DB errors never fail the primary event; we
    return None and the workflow-engine association path noops just as it
    did before.
    """

    try:
        from sentry.lang.native.grouptype import GpuCrashGroupType
        from sentry.workflow_engine.models import Detector

        detector, _ = Detector.objects.get_or_create(
            project=project,
            type=GpuCrashGroupType.slug,
            defaults={"name": "GPU Crash Detector", "config": {}},
        )
        return detector.id
    except Exception as e:  # pragma: no cover — best effort
        sentry_sdk.capture_exception(e)
        return None


# ─────────────────────── occurrence + GPU event emission ──────────────────


def _build_evidence_display(
    response: Mapping[str, Any],
    fault: Mapping[str, Any],
    gpu_state: Mapping[str, Any],
    primary_shader: Mapping[str, Any],
) -> list[Any]:
    """Issue UI "evidence" rows — the right-hand sidebar on the issue page.

    Pulls only fields that are always meaningful for triage; skips
    anything not present in the response so the sidebar doesn't carry
    `None`/empty rows.
    """

    from sentry.issues.issue_occurrence import IssueEvidence

    rows: list[IssueEvidence] = []
    category = response.get("fault_category") or "unknown"
    rows.append(IssueEvidence(name="Category", value=category, important=True))
    if fault.get("type"):
        rows.append(IssueEvidence(name="Fault", value=str(fault["type"]), important=True))
    # Primary resource (page faults / DMA faults) — the most actionable
    # field for non-shader crashes.
    resources = fault.get("resources") or []
    for r in resources:
        name = r.get("debug_name") if isinstance(r, dict) else None
        if name:
            rows.append(IssueEvidence(name="Resource", value=str(name), important=True))
            break
    if primary_shader.get("shader_hash"):
        rows.append(
            IssueEvidence(name="Shader", value=str(primary_shader["shader_hash"]), important=False)
        )
    if primary_shader.get("shader_type"):
        rows.append(
            IssueEvidence(
                name="Shader type", value=str(primary_shader["shader_type"]), important=False
            )
        )
    if fault.get("virtual_address"):
        rows.append(
            IssueEvidence(
                name="Virtual address", value=str(fault["virtual_address"]), important=False
            )
        )
    if fault.get("access_type"):
        rows.append(IssueEvidence(name="Access", value=str(fault["access_type"]), important=False))
    if gpu_state.get("device_name"):
        rows.append(IssueEvidence(name="GPU", value=str(gpu_state["device_name"]), important=False))
    if gpu_state.get("driver_version"):
        rows.append(
            IssueEvidence(name="Driver", value=str(gpu_state["driver_version"]), important=False)
        )
    if response.get("handler"):
        rows.append(IssueEvidence(name="Handler", value=str(response["handler"]), important=False))
    return rows


def _produce_gpu_occurrence(
    data: Any,
    project: Any,
    event_id: str,
    response: Mapping[str, Any],
) -> None:
    """Fire a secondary IssueOccurrence for the GPU crash.

    Mints a fresh event with the GPU stacktrace (rather than reusing the
    CPU minidump event) so the issue detail page renders shader frames
    (or the synthetic fault frame for non-shader crashes) instead of the
    CPU unwind. The two events share ``contexts.trace.trace_id`` so they
    co-locate in the trace view.

    Grouping is delegated to teapot: the `fingerprint` array on the
    response is used verbatim. Teapot composes it per `fault_category`
    so groups stay stable across crash shapes (e.g. all page faults on
    `StreamingTextureAtlas` group together regardless of randomised VA).
    """

    from sentry.issues.issue_occurrence import IssueOccurrence
    from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka

    # Importing the module triggers `__init_subclass__`, which registers
    # the class with the global GroupType registry before we reference it.
    from sentry.lang.native.grouptype import GpuCrashGroupType

    fault = response.get("fault") or {}
    gpu_state = response.get("gpu_state") or {}
    shader_context = response.get("shader_context") or {}
    active_shaders = shader_context.get("active_shaders") or []
    primary_shader = active_shaders[0] if active_shaders else {}

    # Teapot supplies the grouping fingerprint and the title directly.
    # Fall back to ad-hoc values only when the response is from an older
    # teapot that doesn't emit them — that path is for forward-compat
    # safety; current teapot always sets both.
    category = response.get("fault_category") or "unknown"
    fingerprint = list(response.get("fingerprint") or [])
    if not fingerprint:
        fingerprint = ["gpu", category]
    issue_title = response.get("title") or f"GPU crash ({category})"

    subtitle_parts: list[str] = []
    if fault.get("virtual_address"):
        subtitle_parts.append(f"@ {fault['virtual_address']}")
    if gpu_state.get("device_name"):
        subtitle_parts.append(str(gpu_state["device_name"]))
    if gpu_state.get("driver_version"):
        subtitle_parts.append(f"driver {gpu_state['driver_version']}")
    subtitle = " · ".join(subtitle_parts) or fault.get("description") or category

    evidence_display = _build_evidence_display(response, fault, gpu_state, primary_shader)

    private = data.get("_gpu_crash_private") or {}
    frames = private.get("frames") or []
    markers = private.get("markers") or []

    evidence_data: dict[str, Any] = {
        "fault_category": category,
        "fault": fault,
        "gpu_state": gpu_state,
        "shader_context": shader_context,
        "frames": frames,
        "markers": markers,
        "missing_difs": response.get("missing_difs") or [],
        "handler": response.get("handler"),
    }
    detector_id = _get_or_create_gpu_detector_id(project)
    if detector_id is not None:
        evidence_data["detector_id"] = detector_id

    gpu_event_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc)

    trace_context = ((data.get("contexts") or {}).get("trace") or {}).copy()

    gpu_contexts: dict[str, Any] = {
        "gpu_crash": _build_flat_gpu_context(response),
        "gpu_crash_raw": _build_gpu_raw_context(response),
    }
    if trace_context:
        gpu_contexts["trace"] = trace_context
    if gpu_state.get("device_name"):
        gpu_contexts["gpu"] = {
            "name": gpu_state["device_name"],
            "driver_version": gpu_state.get("driver_version"),
            "vendor_name": "NVIDIA",
            "api": gpu_state.get("api"),
        }
    if gpu_state.get("os_version"):
        gpu_contexts["os"] = {
            "name": gpu_state["os_version"],
            "type": "os",
        }
    if gpu_state.get("application_name"):
        gpu_contexts["app"] = {
            "app_name": gpu_state["application_name"],
            "type": "app",
        }

    breadcrumbs = _markers_to_breadcrumbs(markers)

    # The issue-platform occurrence consumer at
    # src/sentry/issues/occurrence_consumer.py whitelists which fields it
    # copies from `event_payload` onto the persisted event — `exception`
    # is NOT in that list but `stacktrace` IS. Put the GPU frames at the
    # top level so the issue detail page actually renders them; the
    # occurrence title carries the fault category / title from teapot
    # since there's nowhere to put `exception.type` / `value`.
    gpu_event_data: dict[str, Any] = {
        "event_id": gpu_event_id,
        "project_id": project.id,
        "platform": "native",
        "level": "fatal",
        "timestamp": now.timestamp(),
        "received": now.timestamp(),
        "contexts": gpu_contexts,
        "tags": _merge_cpu_tags(
            data.get("tags"),
            {
                "gpu.fault_category": category,
                "gpu.fault_type": fault.get("type") or "Unknown",
                "cpu_event_id": event_id,
                **(
                    {"gpu.shader_hash": primary_shader["shader_hash"]}
                    if primary_shader.get("shader_hash")
                    else {}
                ),
                **(
                    {"gpu.shader_type": primary_shader["shader_type"]}
                    if primary_shader.get("shader_type")
                    else {}
                ),
            },
        ),
        "stacktrace": {"frames": _normalize_gpu_frames(frames)},
        "sdk": (data.get("sdk") or {"name": "teapot", "version": "0.1.0"}),
        "release": data.get("release"),
        "environment": data.get("environment"),
    }
    if breadcrumbs:
        gpu_event_data["breadcrumbs"] = {"values": breadcrumbs}

    occurrence = IssueOccurrence(
        id=uuid.uuid4().hex,
        project_id=project.id,
        event_id=gpu_event_id,
        fingerprint=fingerprint,
        issue_title=issue_title,
        subtitle=subtitle,
        resource_id=None,
        evidence_data=evidence_data,
        evidence_display=evidence_display,
        type=GpuCrashGroupType,
        detection_time=now,
        level="fatal",
        culprit=primary_shader.get("shader_hash") or category,
    )

    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE,
        occurrence=occurrence,
        event_data=gpu_event_data,
    )
    metrics.incr("process.gpu.occurrence.produced", tags={"fault_category": category})


# ─────────────────────────── frame / tag helpers ──────────────────────────


def _merge_cpu_tags(
    cpu_tags: Any,
    extra: Mapping[str, str],
) -> dict[str, str]:
    """Merge tags from the CPU event (dict or list-of-pairs form) with extras."""

    merged: dict[str, str] = {}
    if isinstance(cpu_tags, dict):
        for k, v in cpu_tags.items():
            if k is not None and v is not None:
                merged[str(k)] = str(v)
    elif isinstance(cpu_tags, list):
        for entry in cpu_tags:
            if isinstance(entry, (list, tuple)) and len(entry) == 2:
                key, value = entry
                if key is not None and value is not None:
                    merged[str(key)] = str(value)
            elif isinstance(entry, dict) and "key" in entry and "value" in entry:
                merged[str(entry["key"])] = str(entry["value"])
    for k, v in extra.items():
        if v is not None:
            merged[k] = str(v)
    return merged


def _markers_to_breadcrumbs(markers: Any) -> list[dict[str, Any]]:
    """Map teapot's `markers` array to Sentry event breadcrumbs.

    For non-shader crashes (page faults, OOM, device reset, ...) these
    are usually the only actionable signal — Aftermath captures the
    CPU-side context that submitted the faulting GPU work via
    `Aftermath markers` and `UserDefined+N` description keys. Surfacing
    them as breadcrumbs puts them in the standard issue-page timeline
    rather than buried in a context blob.
    """

    if not isinstance(markers, list):
        return []
    out: list[dict[str, Any]] = []
    for m in markers:
        if not isinstance(m, dict):
            continue
        kind = m.get("kind") or "marker"
        label = m.get("label") or kind
        data = m.get("data")
        msg = label if isinstance(data, (dict, list)) else f"{label}: {data}"
        out.append(
            {
                "category": f"gpu.{kind}",
                "message": str(msg)[:512],
                "type": "info",
                "level": "info",
                "data": data if isinstance(data, (dict, list)) else None,
            }
        )
    return out


def _normalize_gpu_frames(teapot_frames: Any) -> list[dict[str, Any]]:
    """Map teapot's ``frames[]`` to Sentry event stacktrace frames.

    Teapot now emits frames with all the relevant fields pre-populated —
    `function`, `module`, `filename`, `abs_path`, `lineno`, and
    `data.synthetic` — so this is mostly a pass-through with a couple
    of normalisations:

    * Mark every frame `symbolicator_status=symbolicated` so Sentry's
      UI doesn't paint the warning triangle (no `debug_meta.images`
      entry exists for shader frames; without the explicit status the
      symbolicator walker marks them `missing`).
    * Synthesise a `package` from the shader hash so the frame's
      module column renders something useful.

    Synthetic frames (`data.synthetic = true`, emitted for non-shader
    crashes like page faults) carry the same metadata shape; the only
    difference is they have no `data.shader_hash`.
    """

    if not isinstance(teapot_frames, list):
        return []

    normalized: list[dict[str, Any]] = []
    for raw in teapot_frames:
        if not isinstance(raw, dict):
            continue

        frame: dict[str, Any] = {}
        for src, dst in (
            ("function", "function"),
            ("module", "module"),
            ("filename", "filename"),
            ("abs_path", "abs_path"),
            ("lineno", "lineno"),
            ("colno", "colno"),
            ("instruction_addr", "instruction_addr"),
            ("pre_context", "pre_context"),
            ("context_line", "context_line"),
            ("post_context", "post_context"),
        ):
            value = raw.get(src)
            if value is not None:
                frame[dst] = value
        if raw.get("data"):
            frame["data"] = dict(raw["data"])

        # Synthesise a package from the shader hash so the module column
        # renders something useful (only for real shader frames; synthetic
        # frames already have a meaningful `module` like "Graphics").
        frame_data = raw.get("data") or {}
        shader_hash = frame_data.get("shader_hash")
        if shader_hash and not frame.get("package"):
            frame["package"] = (
                shader_hash if shader_hash.startswith("shader_") else f"shader_{shader_hash}"
            )
        if not frame.get("module") and frame.get("package"):
            frame["module"] = frame["package"]

        frame.setdefault("data", {})
        frame["data"].setdefault("symbolicator_status", "symbolicated")
        frame.setdefault("in_app", True)
        normalized.append(frame)
    return normalized
