"""GPU crash dump enrichment — teapot response → Sentry event.

Self-contained module that owns everything specific to the GPU crash flow:

* attachment-type detection (via `find_gpu_crash_dump_attachment` in utils)
* the HTTP call-out to teapot (in `teapot.py`)
* merging the response into `contexts.gpu_crash`
* minting a separate GPU event + producing the secondary IssueOccurrence
* parsing the Aftermath raw blob into a flat context and an enriched frame
* demo-only helpers for shader source context

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

from sentry.utils import json as _json
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
    `IssueOccurrence` — a distinct issue grouped by shader + fault type,
    referencing the same `trace_id` as the CPU issue via a fresh GPU event.
    """

    # Deferred imports: avoids importing `requests` and the issue platform
    # at module import time for processes that don't touch this path.
    from sentry.lang.native.teapot import submit_to_teapot
    from sentry.lang.native.utils import find_gpu_crash_dump_attachment

    dump = find_gpu_crash_dump_attachment(data)
    if not dump:
        return data

    metrics.incr("process.gpu.symbolicate.request")
    response = submit_to_teapot(project, event_id, dump.load_data(project))
    if response is None:
        metrics.incr("process.gpu.symbolicate.skipped")
        return data

    _merge_gpu_response(data, response)
    metrics.incr(
        "process.gpu.symbolicate.completed",
        tags={"status": response.get("status") or "unknown"},
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
    collapses nested objects under ``> { N items }``. Flattening the fault
    / gpu_state / shader_context into scalar fields means every useful
    value shows up without the user having to expand. The full nested
    blobs live on ``contexts.gpu_crash_raw`` for deep debugging.

    Shared between ``_merge_gpu_response`` (enriches the CPU event) and
    ``_produce_gpu_occurrence`` (builds the dedicated GPU event) so both
    produce the same shape.
    """

    fault = response.get("fault") or {}
    gpu_state = response.get("gpu_state") or {}
    shader = response.get("shader_context") or {}
    raw_extras = _parse_aftermath_raw(shader.get("raw") or [])

    active_shaders = shader.get("active_shaders") or []
    primary_shader = active_shaders[0] if active_shaders else {}

    shader_hash = shader.get("shader_hash") or primary_shader.get("shader_hash")

    fault_type = fault.get("type")
    if not fault_type or fault_type == "Unknown":
        device_status = gpu_state.get("device_status")
        if gpu_state.get("engine_reset"):
            fault_type = "TDR / engine reset"
        elif gpu_state.get("adapter_reset"):
            fault_type = "Adapter reset"
        elif isinstance(device_status, str) and device_status:
            fault_type = f"Device {device_status}"
        else:
            fault_type = "GPU crash"

    flat: dict[str, Any] = {
        "type": "gpu_crash",
        "status": response.get("status"),
        "handler": response.get("handler"),
        "sdk_version": response.get("sdk_version"),
        "decode_time_ms": response.get("decode_time_ms"),
        # Fault
        "fault_type": fault_type,
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
        "application_name": gpu_state.get("application_name") or raw_extras.get("application_name"),
        "application_version": raw_extras.get("application_version"),
        "engine_reset": gpu_state.get("engine_reset"),
        "adapter_reset": gpu_state.get("adapter_reset"),
        # Shader
        "shader_hash": shader_hash,
        "shader_name": raw_extras.get("shader_name"),
        "shader_type": primary_shader.get("shader_type"),
        "shader_debug_info_uid": primary_shader.get("shader_debug_info_uid"),
        "pc_address": raw_extras.get("pc_address"),
        # Missing debug files (surface count so users see they need to upload)
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
    }


def _merge_gpu_response(data: Any, response: Mapping[str, Any]) -> None:
    """Write teapot's response into the event's gpu_crash context.

    Never mutates the primary exception, debug_meta images, or trace context —
    GPU symbolication is additive enrichment. Frames for the secondary
    IssueOccurrence are stashed privately on ``data["_gpu_crash_private"]``
    and never land in the user-visible event.
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

    frames = response.get("frames") or []
    if frames:
        # Private channel: picked up by the occurrence producer. Not
        # persisted into Snuba / not shown in the UI.
        data.setdefault("_gpu_crash_private", {})["frames"] = frames


# ─────────────────────────── detector wiring ──────────────────────────────


def _get_or_create_gpu_detector_id(project: Any) -> int | None:
    """Return the Detector id that issue-platform associates GPU crash groups with.

    Without a real Detector row, `associate_new_group_with_detector` (at
    src/sentry/workflow_engine/processors/detector.py) emits a WARN for
    every new GPU group and skips the DetectorGroup link. Providing one
    via `occurrence.evidence_data["detector_id"]` is picked up by
    `save_issue_from_occurrence` (src/sentry/issues/ingest.py:262).

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


def _produce_gpu_occurrence(
    data: Any,
    project: Any,
    event_id: str,
    response: Mapping[str, Any],
) -> None:
    """Fire a secondary IssueOccurrence for the GPU crash.

    Mints a fresh event with the GPU stacktrace (rather than reusing the
    CPU minidump event) so the issue detail page renders shader frames
    instead of the CPU unwind. The two events share
    ``contexts.trace.trace_id`` so they co-locate in the trace view.
    Grouping is by ``{fault.type, shader_hash}``.
    """

    from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
    from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka

    # Importing the module triggers `__init_subclass__`, which registers
    # the class with the global GroupType registry before we reference it.
    from sentry.lang.native.grouptype import GpuCrashGroupType

    fault = response.get("fault") or {}
    gpu_state = response.get("gpu_state") or {}
    shader = response.get("shader_context") or {}
    raw_extras = _parse_aftermath_raw(shader.get("raw") or [])

    shader_hash = shader.get("shader_hash")
    active_shaders = shader.get("active_shaders") or []
    primary_shader = active_shaders[0] if active_shaders else {}
    if not shader_hash and primary_shader:
        shader_hash = primary_shader.get("shader_hash")

    entry_point = (
        shader.get("entry_point")
        or raw_extras.get("shader_name")
        or (
            f"{primary_shader['shader_type']} shader" if primary_shader.get("shader_type") else None
        )
    )

    fault_type = fault.get("type")
    if not fault_type or fault_type == "Unknown":
        device_status = gpu_state.get("device_status")
        if gpu_state.get("engine_reset"):
            fault_type = "TDR / engine reset"
        elif gpu_state.get("adapter_reset"):
            fault_type = "Adapter reset"
        elif isinstance(device_status, str) and device_status:
            fault_type = f"Device {device_status}"
        else:
            fault_type = "GPU crash"

    shader_hash = shader_hash or "unknown"
    entry_point = entry_point or shader_hash

    fingerprint = [f"gpu-crash:{fault_type}:{shader_hash}"]
    issue_title = f"GPU crash: {fault_type} in {entry_point}"

    subtitle_parts: list[str] = []
    if fault.get("virtual_address"):
        subtitle_parts.append(f"@ {fault['virtual_address']}")
    if shader.get("source_language"):
        subtitle_parts.append(shader["source_language"])
    if not subtitle_parts and gpu_state.get("device_name"):
        subtitle_parts.append(gpu_state["device_name"])
    subtitle = " · ".join(subtitle_parts) or fault.get("code") or fault.get("description") or ""

    evidence_display = [
        IssueEvidence(name="Fault", value=fault_type, important=True),
        IssueEvidence(name="Shader", value=shader_hash, important=False),
    ]
    if primary_shader.get("shader_type"):
        evidence_display.append(
            IssueEvidence(
                name="Shader type",
                value=str(primary_shader["shader_type"]),
                important=False,
            )
        )
    if fault.get("virtual_address"):
        evidence_display.append(
            IssueEvidence(
                name="Virtual address",
                value=str(fault["virtual_address"]),
                important=False,
            )
        )
    if gpu_state.get("device_name"):
        evidence_display.append(
            IssueEvidence(
                name="GPU",
                value=str(gpu_state["device_name"]),
                important=False,
            )
        )
    if gpu_state.get("driver_version"):
        evidence_display.append(
            IssueEvidence(
                name="Driver",
                value=str(gpu_state["driver_version"]),
                important=False,
            )
        )
    if response.get("handler"):
        evidence_display.append(
            IssueEvidence(
                name="Handler",
                value=str(response["handler"]),
                important=False,
            )
        )

    frames = (data.get("_gpu_crash_private") or {}).get("frames") or []

    evidence_data: dict[str, Any] = {
        "fault": fault,
        "shader_context": shader,
        "gpu_state": response.get("gpu_state") or {},
        "frames": frames,
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
    if gpu_state.get("application_name") or raw_extras.get("application_name"):
        gpu_contexts["app"] = {
            "app_name": gpu_state.get("application_name") or raw_extras.get("application_name"),
            "app_version": raw_extras.get("application_version"),
            "type": "app",
        }

    # The issue-platform occurrence consumer at
    # src/sentry/issues/occurrence_consumer.py:254-283 whitelists which
    # fields it copies from `event_payload` onto the persisted event —
    # `exception` is NOT in that list but `stacktrace` IS. Put the GPU
    # frames at the top level so the issue detail page actually renders
    # them; the occurrence title carries the fault type / entry point for
    # display since there's nowhere to put `exception.type` / `value`.
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
                "gpu.fault_type": fault_type,
                "gpu.shader_hash": shader_hash,
                "cpu_event_id": event_id,
                **(
                    {"gpu.shader_type": primary_shader["shader_type"]}
                    if primary_shader.get("shader_type")
                    else {}
                ),
            },
        ),
        "stacktrace": {"frames": _normalize_gpu_frames(frames, raw_extras)},
        "sdk": (data.get("sdk") or {"name": "teapot", "version": "0.1.0"}),
        "release": data.get("release"),
        "environment": data.get("environment"),
    }

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
        culprit=entry_point,
    )

    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE,
        occurrence=occurrence,
        event_data=gpu_event_data,
    )
    metrics.incr("process.gpu.occurrence.produced")


# ─────────────────────────── raw-blob parsing ─────────────────────────────


def _parse_aftermath_raw(raw: Any) -> dict[str, Any]:
    """Hoist interesting fields out of teapot's nested Aftermath raw blob.

    Teapot passes through the NVIDIA decoder's JSON verbatim under
    ``shader_context.raw`` — a list of single-key objects. Extract:

    * ``shader_name`` (e.g. "vertex_02") from ``Shader infos.Info.Shader name``
    * ``pc_address`` (e.g. "0x00000330") from ``Active Warps[0].GPU PC Address``
    * ``application_version`` from ``ApplicationVersion``
    * ``application_name`` from ``ApplicationName``
    * ``cpu_callstack`` from ``Aftermath markers`` — the CPU-side call
      chain that submitted the faulting GPU work

    Quietly returns an empty dict if the structure diverges.
    """

    if not isinstance(raw, list):
        return {}

    out: dict[str, Any] = {}
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        for key, value in entry.items():
            if key == "ApplicationName" and isinstance(value, str):
                out.setdefault("application_name", value)
            elif key == "ApplicationVersion" and isinstance(value, str):
                out.setdefault("application_version", value)
            elif key == "Shader infos" and isinstance(value, dict):
                info = value.get("Info")
                if isinstance(info, dict):
                    name = info.get("Shader name")
                    if isinstance(name, str):
                        out.setdefault("shader_name", name)
            elif key == "Active Warps" and isinstance(value, list) and value:
                warp = value[0]
                if isinstance(warp, dict):
                    gpu_pc = warp.get("GPU PC Address")
                    if isinstance(gpu_pc, str):
                        if "@" in gpu_pc:
                            pc_hex = gpu_pc.rsplit("@", 1)[1].strip()
                        else:
                            pc_hex = gpu_pc.strip()
                        if pc_hex:
                            out.setdefault("pc_address", pc_hex)
                    count = warp.get("Warp count")
                    if isinstance(count, int):
                        out.setdefault("warp_count", count)
            elif key == "Aftermath markers" and isinstance(value, list) and value:
                stack = _parse_aftermath_marker_callstack(value)
                if stack:
                    out.setdefault("cpu_callstack", stack)
    return out


def _parse_aftermath_marker_callstack(
    markers: list[Any],
) -> list[dict[str, str]]:
    """Extract the CPU call stack embedded in Aftermath markers.

    The shape we walk (seen empirically against the upstream sample):

        markers[i]["Context"] is a JSON *string* that deserializes to
            {"Events": [{"Event": {"Callstack": {"Stack": [
                {"Entry": {"Module name": "...", "Pointer": <int>}}, ...
            ]}}}]}

    Returns a flat list of ``{"module": str, "pointer": "0x<hex>"}`` — one
    entry per stack frame, outermost → innermost (matches Aftermath's
    order; we don't reverse).
    """

    out: list[dict[str, str]] = []
    for marker in markers:
        if not isinstance(marker, dict):
            continue
        ctx_raw = marker.get("Context")
        if not isinstance(ctx_raw, str) or not ctx_raw:
            continue
        try:
            ctx = _json.loads(ctx_raw)
        except (ValueError, TypeError):
            continue

        events = ctx.get("Events") if isinstance(ctx, dict) else None
        if not isinstance(events, list):
            continue
        for event_wrap in events:
            if not isinstance(event_wrap, dict):
                continue
            event = event_wrap.get("Event")
            if not isinstance(event, dict):
                continue
            callstack = event.get("Callstack")
            if not isinstance(callstack, dict):
                continue
            stack = callstack.get("Stack")
            if not isinstance(stack, list):
                continue
            for entry_wrap in stack:
                if not isinstance(entry_wrap, dict):
                    continue
                entry = entry_wrap.get("Entry")
                if not isinstance(entry, dict):
                    continue
                module = entry.get("Module name")
                pointer = entry.get("Pointer")
                if isinstance(module, str) and isinstance(pointer, int):
                    out.append(
                        {
                            "module": module,
                            "pointer": f"0x{pointer:016x}",
                        }
                    )
    return out


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


def _normalize_gpu_frames(
    teapot_frames: Any,
    raw_extras: Mapping[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Map teapot's ``frames[]`` to Sentry event stacktrace frames.

    Teapot emits minimal frames (``function`` = shader type, ``module`` =
    shader hash) because the rich instruction info lives in a separate
    ``Active Warps`` section of the raw Aftermath JSON. ``raw_extras`` —
    produced by ``_parse_aftermath_raw`` — lets us promote the shader
    symbol name ("vertex_02") and the faulting PC onto the primary frame.

    We also mark frames as ``symbolicator_status=symbolicated`` and drop
    ``addr_mode=shader``. Without that, Sentry's symbolicator walks over
    the frame looking for a matching ``debug_meta.images`` entry (there
    isn't one — shader images aren't a thing in the native debug-image
    schema), tags the frame as ``missing``, and the UI paints the warning
    triangle + ``<unknown>`` module that makes it look broken.
    """

    extras = raw_extras or {}
    if not isinstance(teapot_frames, list):
        return []

    normalized: list[dict[str, Any]] = []
    for idx, raw in enumerate(teapot_frames):
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

        # Enrich BEFORE synthesizing filename from function.
        if idx == 0:
            shader_name = extras.get("shader_name")
            if shader_name and (
                not frame.get("function")
                or frame["function"] == raw.get("data", {}).get("shader_type")
            ):
                frame["function"] = shader_name
            if extras.get("pc_address") and not frame.get("instruction_addr"):
                frame["instruction_addr"] = extras["pc_address"]
            if extras.get("warp_count") is not None:
                frame.setdefault("data", {})["warp_count"] = extras["warp_count"]

        # Prefer the filename the bundle manifest declared — the heuristic
        # synthesises one from `function + .hlsl`, which is fine but less
        # accurate than what the customer actually shipped. PC→line mapping
        # belongs in the *debug* artifact (`.nvdbg` for shaders, like
        # PDB/DWARF for native code) and isn't carried in source bundles —
        # mirrors symbolic's split. Until we wire DXC PDB / Aftermath line
        # tables, lineno comes from the heuristic hot-line picker below.
        #
        # `abs_path` mirrors `filename` so SCM stacktrace-link / on-demand
        # source fetching can match the frame against a project's code
        # mapping (the linker keys on abs_path, not filename). Whatever
        # repo-relative path the customer's build pipeline passes to
        # `teapot-shader-bundle --source` lands here.
        frame_data = raw.get("data") or {}
        if not frame.get("filename") and frame_data.get("shader_filename"):
            frame["filename"] = frame_data["shader_filename"]
        if not frame.get("abs_path") and frame.get("filename"):
            frame["abs_path"] = frame["filename"]

        if not frame.get("context_line"):
            shader_source = frame_data.get("shader_source")
            if shader_source:
                _apply_shader_source_context(frame, shader_source)

        module_hash = (raw.get("data") or {}).get("shader_hash") or raw.get("module")
        if module_hash and not frame.get("package"):
            frame["package"] = (
                module_hash if module_hash.startswith("shader_") else f"shader_{module_hash}"
            )
        if not frame.get("module") and frame.get("package"):
            frame["module"] = frame["package"]

        frame.setdefault("data", {})
        frame["data"].setdefault("symbolicator_status", "symbolicated")
        frame.setdefault("in_app", True)
        normalized.append(frame)
    return normalized


def _apply_shader_source_context(frame: dict[str, Any], shader_source: str) -> None:
    """Split a full shader source blob into Sentry frame context windows.

    Without real PC→line mapping (needs a PDB + DXIL debug info, not
    available from the ``.nvdbg`` alone) we heuristically pick the hot
    line: prefer an explicit ``lineno`` if set, otherwise the first
    ``while`` / ``for`` / ``[loop]`` line (where TDR-style hangs live),
    otherwise the middle of the file. Imprecise but produces a useful
    snippet — production wiring (PDB / source bundle via DifResolver)
    replaces the heuristic with a real line.
    """

    if not shader_source:
        return

    lines = shader_source.splitlines()
    if not lines:
        return

    hot_index: int | None = None
    explicit = frame.get("lineno")
    if isinstance(explicit, int) and 0 < explicit <= len(lines):
        hot_index = explicit - 1
    if hot_index is None:
        for i, line in enumerate(lines):
            stripped = line.strip().lower()
            if stripped.startswith(("while", "[loop]", "for ", "for(")):
                hot_index = i
                break
    if hot_index is None:
        hot_index = len(lines) // 2

    window = 5
    pre_start = max(0, hot_index - window)
    post_end = min(len(lines), hot_index + 1 + window)

    frame["context_line"] = lines[hot_index]
    frame["pre_context"] = lines[pre_start:hot_index]
    frame["post_context"] = lines[hot_index + 1 : post_end]
    frame.setdefault("lineno", hot_index + 1)

    if not frame.get("filename"):
        guess_name = frame.get("function") or frame.get("module") or "shader"
        extension = ".hlsl"
        for line in lines[:5]:
            low = line.lower()
            if ".glsl" in low:
                extension = ".glsl"
                break
            if ".slang" in low:
                extension = ".slang"
                break
        frame["filename"] = f"{guess_name}{extension}"
