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

    fault = _as_dict(response.get("fault"))
    gpu_state = _as_dict(response.get("gpu_state"))
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
    data["fingerprint"] = list(_as_list(response.get("fingerprint"))) or ["gpu", category]
    data["exception"] = {
        "values": [
            {
                "type": exc_type,
                "value": exc_value,
                "stacktrace": {"frames": _normalize_gpu_frames(_as_list(response.get("frames")))},
                "mechanism": {"type": "gpu_crash", "handled": False},
            }
        ]
    }

    contexts = data.get("contexts")
    if not isinstance(contexts, dict):
        contexts = {}
    contexts["gpu_crash"] = _build_flat_gpu_context(response)
    if gpu_state.get("device_name"):
        contexts["gpu"] = {
            "name": gpu_state["device_name"],
            "driver_version": gpu_state.get("driver_version"),
            "vendor_name": "NVIDIA",
            "api": gpu_state.get("api"),
        }
    # Only fill os/app if the copied SDK scope didn't (teapot's are thinner).
    # `os_version` is a combined string ("Windows 10 (19H1)"), so it's the raw
    # description — not `name` (which drives OS filtering and wants the identity).
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

    breadcrumbs = _markers_to_breadcrumbs(_as_list(response.get("markers")))
    if breadcrumbs:
        data["breadcrumbs"] = {"values": breadcrumbs}

    metrics.incr("process.gpu.event.symbolicated", tags={"fault_category": category})
    return data


def _as_dict(value: Any) -> dict[str, Any]:
    """Coerce untrusted teapot JSON to a dict (``{}`` otherwise)."""
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    """Coerce untrusted teapot JSON to a list (``[]`` otherwise)."""
    return value if isinstance(value, list) else []


def _primary_shader(response: Mapping[str, Any]) -> dict[str, Any]:
    """First active shader, or ``{}`` (every level is untrusted JSON)."""
    active_shaders = _as_dict(response.get("shader_context")).get("active_shaders")
    if not isinstance(active_shaders, list) or not active_shaders:
        return {}
    return _as_dict(active_shaders[0])


def _build_flat_gpu_context(response: Mapping[str, Any]) -> dict[str, Any]:
    """Flatten teapot's response into ``contexts.gpu_crash``.

    Flat scalars render inline in the context card; nested objects would collapse
    behind ``> { N items }``.
    """

    fault = _as_dict(response.get("fault"))
    gpu_state = _as_dict(response.get("gpu_state"))
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
        "missing_dif_count": len(_as_list(response.get("missing_difs"))),
    }
    warnings = _as_list(response.get("warnings"))
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


def _markers_to_breadcrumbs(markers: Any) -> list[dict[str, Any]]:
    """Map teapot's ``markers`` to breadcrumbs (often the only signal for
    non-shader crashes)."""
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
    """Map teapot's ``frames[]`` to Sentry stacktrace frames: pass through known
    fields, force ``symbolicator_status=symbolicated`` (shader frames have no
    debug image), and synthesise ``package`` from the shader hash."""
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
        # `data` is external — only trust a mapping.
        raw_data = raw.get("data")
        if not isinstance(raw_data, dict):
            raw_data = {}
        if raw_data:
            frame["data"] = dict(raw_data)

        shader_hash = raw_data.get("shader_hash")
        if isinstance(shader_hash, str) and shader_hash and not frame.get("package"):
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
