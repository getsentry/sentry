"""Apply teapot's GPU crash decode to the in-flight event.

Relay splits the ``.nv-gpudmp`` onto its own native event with identity/trace/
release already set; this maps teapot's decode onto it (exception, fingerprint,
GPU contexts, tags, breadcrumbs) before save. Enriches only — never bills.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping, MutableMapping
from typing import Any

from sentry.utils import metrics

logger = logging.getLogger(__name__)

# NVIDIA Aftermath GPU crash dump attachment, decoded by teapot.
GPU_CRASH_DUMP_ATTACHMENT_TYPE = "event.nv_gpudmp"


def apply_gpu_crash_symbolication(
    data: MutableMapping[str, Any], response: Mapping[str, Any]
) -> MutableMapping[str, Any] | None:
    """Apply teapot's decode to the in-flight GPU event, mutating ``data``.

    Returns the mutated event on success, or ``None`` for a ``failed``/unknown
    status (the event is still saved, unenriched). Relay owns identity, trace,
    release and base tags; this only fills the GPU-specific fields.
    """
    status = response.get("status")
    if status not in ("completed", "partial"):
        metrics.incr("process.gpu.event.skipped", tags={"status": status or "unknown"})
        return None

    fault = response.get("fault") or {}
    gpu_state = response.get("gpu_state") or {}
    primary_shader = _primary_shader(response)
    category = response.get("fault_category") or "unknown"

    exc_type = response.get("title") or f"GPU crash ({category})"
    subtitle_parts: list[str] = []
    if fault.get("virtual_address"):
        subtitle_parts.append(f"@ {fault['virtual_address']}")
    if gpu_state.get("device_name"):
        subtitle_parts.append(str(gpu_state["device_name"]))
    if gpu_state.get("driver_version"):
        subtitle_parts.append(f"driver {gpu_state['driver_version']}")
    exc_value = " · ".join(subtitle_parts) or fault.get("description") or category

    data["platform"] = "native"
    data["level"] = "fatal"
    data["type"] = "error"
    data["fingerprint"] = list(response.get("fingerprint") or []) or ["gpu", category]
    data["exception"] = {
        "values": [
            {
                "type": exc_type,
                "value": exc_value,
                "stacktrace": {"frames": _normalize_gpu_frames(response.get("frames") or [])},
                "mechanism": {"type": "gpu_crash", "handled": False},
            }
        ]
    }

    contexts = data.get("contexts")
    if not isinstance(contexts, dict):
        contexts = {}
    contexts["gpu_crash"] = _build_flat_gpu_context(response)
    if any(gpu_state.get(k) for k in ("device_name", "driver_version", "api")):
        gpu_ctx = dict(contexts.get("gpu") or {})
        if gpu_state.get("device_name"):
            gpu_ctx["name"] = gpu_state["device_name"]
        if gpu_state.get("driver_version"):
            gpu_ctx["driver_version"] = gpu_state["driver_version"]
        if gpu_state.get("api"):
            gpu_ctx["api_type"] = gpu_state["api"]
        contexts["gpu"] = gpu_ctx

    if gpu_state.get("os_version") and "os" not in contexts:
        contexts["os"] = {"raw_description": str(gpu_state["os_version"]), "type": "os"}
    if gpu_state.get("application_name") and "app" not in contexts:
        contexts["app"] = {"app_name": gpu_state["application_name"], "type": "app"}
    data["contexts"] = contexts

    gpu_tags: dict[str, str] = {
        "gpu.fault_category": category,
        "gpu.fault_type": fault.get("type") or "Unknown",
    }
    if primary_shader.get("shader_hash"):
        gpu_tags["gpu.shader_hash"] = primary_shader["shader_hash"]
    if primary_shader.get("shader_type"):
        gpu_tags["gpu.shader_type"] = primary_shader["shader_type"]
    data["tags"] = _merge_tags(data.get("tags"), gpu_tags)

    marker_breadcrumbs = _markers_to_breadcrumbs(response.get("markers") or [])
    if marker_breadcrumbs:
        existing = (data.get("breadcrumbs") or {}).get("values") or []
        data["breadcrumbs"] = {"values": [*existing, *marker_breadcrumbs]}

    metrics.incr("process.gpu.event.symbolicated", tags={"fault_category": category})
    return data


def _primary_shader(response: Mapping[str, Any]) -> dict[str, Any]:
    """First active shader from teapot's response, or ``{}``."""
    active = (response.get("shader_context") or {}).get("active_shaders") or []
    return active[0] if active else {}


def _build_flat_gpu_context(response: Mapping[str, Any]) -> dict[str, Any]:
    """Flatten teapot's response into ``contexts.gpu_crash``.

    Flat scalars render inline in the context card; nested objects would collapse
    behind ``> { N items }``.
    """

    fault = response.get("fault") or {}
    gpu_state = response.get("gpu_state") or {}
    primary_shader = _primary_shader(response)

    flat: dict[str, Any] = {
        "type": "gpu_crash",
        "status": response.get("status"),
        "fault_category": response.get("fault_category"),
        "title": response.get("title"),
        "handler": response.get("handler"),
        "sdk_version": response.get("sdk_version"),
        "decode_time_ms": response.get("decode_time_ms"),
        "fault_type": fault.get("type"),
        "fault_description": fault.get("description"),
        "fault_code": fault.get("code"),
        "virtual_address": fault.get("virtual_address"),
        "access_type": fault.get("access_type"),
        "device_name": gpu_state.get("device_name"),
        "device_status": gpu_state.get("device_status"),
        "driver_version": gpu_state.get("driver_version"),
        "graphics_api": gpu_state.get("api"),
        "os_version": gpu_state.get("os_version"),
        "application_name": gpu_state.get("application_name"),
        "engine_reset": gpu_state.get("engine_reset"),
        "adapter_reset": gpu_state.get("adapter_reset"),
        "shader_hash": primary_shader.get("shader_hash"),
        "shader_type": primary_shader.get("shader_type"),
        "shader_debug_info_uid": primary_shader.get("shader_debug_info_uid"),
        "missing_dif_count": len(response.get("missing_difs") or []),
    }
    warnings = response.get("warnings") or []
    if warnings:
        flat["warnings"] = warnings
    return {k: v for k, v in flat.items() if v is not None}


def _merge_tags(existing: Any, extra: Mapping[str, str]) -> list[tuple[str, str]]:
    """Merge existing tags with GPU extras into the pipeline's list-of-pairs form
    (what ``event_manager``'s tag helpers expect). Extras win on collision."""

    merged: dict[str, str] = {}
    if isinstance(existing, dict):
        for k, v in existing.items():
            if k is not None and v is not None:
                merged[str(k)] = str(v)
    elif isinstance(existing, list):
        for entry in existing:
            if isinstance(entry, (list, tuple)) and len(entry) == 2:
                key, value = entry
                if key is not None and value is not None:
                    merged[str(key)] = str(value)
            elif isinstance(entry, dict) and "key" in entry and "value" in entry:
                merged[str(entry["key"])] = str(entry["value"])
    for k, v in extra.items():
        if v is not None:
            merged[k] = str(v)
    return list(merged.items())


def _markers_to_breadcrumbs(markers: list[Any]) -> list[dict[str, Any]]:
    """Map teapot's ``markers`` to breadcrumbs (often the only signal for
    non-shader crashes)."""
    out: list[dict[str, Any]] = []
    for m in markers:
        if not isinstance(m, dict):
            continue
        kind = m.get("kind") or "marker"
        label = m.get("label") or kind
        data = m.get("data")
        # Scalar data goes in the message; a dict/list (or none) leaves it label-only.
        msg = (
            f"{label}: {data}" if data is not None and not isinstance(data, (dict, list)) else label
        )
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


def _normalize_gpu_frames(teapot_frames: list[Any]) -> list[dict[str, Any]]:
    """Map teapot's ``frames[]`` to Sentry stacktrace frames: pass through known
    fields, force ``symbolicator_status=symbolicated`` (shader frames have no
    debug image), and synthesise ``package`` from the shader hash."""
    normalized: list[dict[str, Any]] = []
    for raw in teapot_frames:
        if not isinstance(raw, dict):
            continue
        frame: dict[str, Any] = {}
        for field in (
            "function",
            "module",
            "filename",
            "abs_path",
            "lineno",
            "colno",
            "instruction_addr",
            "pre_context",
            "context_line",
            "post_context",
        ):
            value = raw.get(field)
            if value is not None:
                frame[field] = value
        raw_data = raw.get("data") or {}
        if raw_data:
            frame["data"] = dict(raw_data)

        shader_hash = raw_data.get("shader_hash")
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
