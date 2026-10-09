"""Apply teapot's GPU crash decode to the in-flight event (enrich only, never bills)."""

from __future__ import annotations

import logging
import re
from collections.abc import Mapping, MutableMapping
from typing import Any
from xml.sax.saxutils import unescape as _xml_unescape

from sentry.utils import metrics

logger = logging.getLogger(__name__)

GPU_CRASH_DUMP_ATTACHMENT_TYPE = "event.nv_gpudmp"

# Curated, non-PII subset of UE FGenericCrashContext (no CommandLine/MachineId/LoginId/UserName).
_UNREAL_FIELDS: dict[str, str] = {
    "CrashType": "crash_type",
    "ErrorMessage": "error_message",
    "EngineVersion": "engine_version",
    "BuildVersion": "build_version",
    "BuildConfiguration": "build_config",
    "GameName": "game",
    "PlatformFullName": "platform",
    "EngineMode": "engine_mode",
    "Misc.PrimaryGPUBrand": "gpu_brand",
    "Misc.CPUBrand": "cpu_brand",
    "Misc.OSVersionMajor": "os",
    "MemoryStats.TotalPhysicalGB": "total_ram_gb",
    "SecondsSinceStart": "seconds_since_start",
    "IsEnsure": "is_ensure",
    "IsStall": "is_stall",
    "IsAssert": "is_assert",
}
_UNREAL_BOOL_KEYS = {"is_ensure", "is_stall", "is_assert"}
_UNREAL_INT_KEYS = {"total_ram_gb", "seconds_since_start"}


def apply_gpu_crash_symbolication(
    data: MutableMapping[str, Any], response: Mapping[str, Any]
) -> MutableMapping[str, Any] | None:
    status = response.get("status")
    if status not in ("completed", "partial"):
        metrics.incr("process.gpu.event.skipped", tags={"status": status or "unknown"})
        return None

    fault = response.get("fault") or {}
    gpu_state = response.get("gpu_state") or {}
    primary_shader = _primary_shader(response)
    category = response.get("fault_category") or "unknown"
    unreal = _unreal_context(_raw_sections(response))
    last_op = _last_gpu_operation(response)

    exc_type = response.get("title") or f"GPU crash ({category})"
    subtitle_parts: list[str] = []
    if fault.get("virtual_address"):
        access = fault.get("access_type")
        va = fault["virtual_address"]
        subtitle_parts.append(f"{access} @ {va}" if access else f"@ {va}")
    elif gpu_state.get("device_status") and gpu_state["device_status"] != "Active":
        subtitle_parts.append(str(gpu_state["device_status"]))
    fault_type = fault.get("type")
    if fault_type and fault_type != "Unknown" and fault_type != gpu_state.get("device_status"):
        subtitle_parts.append(str(fault_type))
    if gpu_state.get("device_name"):
        subtitle_parts.append(str(gpu_state["device_name"]))
    if gpu_state.get("driver_version"):
        subtitle_parts.append(f"driver {gpu_state['driver_version']}")
    if last_op:
        subtitle_parts.append(f"during {last_op}")
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
    contexts["gpu_crash"] = _build_gpu_crash_context(response)
    if unreal:
        contexts["unreal"] = {"type": "default", **unreal}
    if any(gpu_state.get(k) for k in ("device_name", "driver_version", "api")) or unreal.get(
        "gpu_brand"
    ):
        gpu_ctx = dict(contexts.get("gpu") or {})
        if gpu_state.get("device_name"):
            gpu_ctx["name"] = gpu_state["device_name"]
        if gpu_state.get("driver_version"):
            gpu_ctx["driver_version"] = gpu_state["driver_version"]
        if gpu_state.get("api"):
            gpu_ctx["api_type"] = gpu_state["api"]
        generation = _generation_name(gpu_state)
        if generation:
            gpu_ctx["generation"] = generation
        if unreal.get("gpu_brand"):
            gpu_ctx["brand"] = unreal["gpu_brand"]
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

    def _tag(key: str, value: Any) -> None:
        if value is not None and str(value) != "":
            gpu_tags[key] = str(value)

    _tag("gpu.shader_hash", primary_shader.get("shader_hash"))
    _tag("gpu.shader_type", primary_shader.get("shader_type"))
    _tag("gpu.device", gpu_state.get("device_name"))
    _tag("gpu.generation", _generation_name(gpu_state))
    _tag("gpu.driver", gpu_state.get("driver_version"))
    _tag("gpu.api", gpu_state.get("api"))
    _tag("gpu.device_status", gpu_state.get("device_status"))
    _tag("gpu.brand", unreal.get("gpu_brand"))
    if _faulting_resource(fault).get("was_destroyed"):
        gpu_tags["gpu.resource_destroyed"] = "true"
    _tag("unreal.engine_version", unreal.get("engine_version"))
    _tag("unreal.build_config", unreal.get("build_config"))
    _tag("unreal.game", unreal.get("game"))
    _tag("unreal.crash_type", unreal.get("crash_type"))
    data["tags"] = _merge_tags(data.get("tags"), gpu_tags)

    marker_breadcrumbs = _markers_to_breadcrumbs(response.get("markers") or [])
    if marker_breadcrumbs:
        existing = (data.get("breadcrumbs") or {}).get("values") or []
        data["breadcrumbs"] = {"values": [*existing, *marker_breadcrumbs]}

    metrics.incr("process.gpu.event.symbolicated", tags={"fault_category": category})
    return data


def _primary_shader(response: Mapping[str, Any]) -> dict[str, Any]:
    active = (response.get("shader_context") or {}).get("active_shaders") or []
    return active[0] if active else {}


def _raw_sections(response: Mapping[str, Any]) -> dict[str, Any]:
    raw = (response.get("shader_context") or {}).get("raw")
    out: dict[str, Any] = {}
    if isinstance(raw, list):
        for section in raw:
            if isinstance(section, dict):
                out.update(section)
    return out


def _decode_data_chunk(node: Any) -> str | None:
    if isinstance(node, dict):
        chunk = node.get("Data chunk")
        if isinstance(chunk, list) and chunk and all(isinstance(b, int) for b in chunk):
            text = bytes(b & 0xFF for b in chunk).split(b"\x00", 1)[0].decode("utf-8", "replace")
            return text.strip() or None
        for value in node.values():
            found = _decode_data_chunk(value)
            if found:
                return found
    elif isinstance(node, list):
        for value in node:
            found = _decode_data_chunk(value)
            if found:
                return found
    return None


def _last_gpu_operation(response: Mapping[str, Any]) -> str | None:
    for marker in response.get("markers") or []:
        if isinstance(marker, dict) and marker.get("kind") == "aftermath":
            text = _decode_data_chunk(marker.get("data"))
            if text:
                return text
    return None


def _marker_callstack(marker_data: Any) -> list[str] | None:
    event = marker_data.get("Event") if isinstance(marker_data, dict) else None
    stack = ((event or {}).get("Callstack") or {}).get("Stack") if isinstance(event, dict) else None
    if not isinstance(stack, list) or not stack:
        return None
    frames: list[str] = []
    for entry in stack:
        e = entry.get("Entry") if isinstance(entry, dict) else None
        if not isinstance(e, dict):
            continue
        module = e.get("Module name") or "?"
        ptr = e.get("Pointer")
        frames.append(f"{module} @ {ptr:#x}" if isinstance(ptr, int) else str(module))
    return frames or None


def _warp_count(sections: Mapping[str, Any]) -> int | None:
    active = sections.get("Active Warps")
    if not isinstance(active, list) or not active:
        return None
    total = 0
    for warp in active:
        n = warp.get("Warp count") if isinstance(warp, dict) else None
        total += n if isinstance(n, int) else 1
    return total or len(active)


def _faulted_warps(sections: Mapping[str, Any]) -> list[dict[str, Any]]:
    raw = sections.get("Faulted Warps")
    out: list[dict[str, Any]] = []
    if isinstance(raw, list):
        for warp in raw:
            if not isinstance(warp, dict):
                continue
            row = {
                "fault_name": warp.get("Fault Name"),
                "fault_detail": warp.get("Fault Description"),
                "pc": warp.get("Shader GPU PC Address"),
                "shader_mapping": warp.get("Shader mapping"),
            }
            cleaned = {k: v for k, v in row.items() if v is not None}
            if cleaned:
                out.append(cleaned)
    return out


def _device_state(sections: Mapping[str, Any]) -> str | None:
    info = sections.get("Device info")
    state = info.get("Device state") if isinstance(info, dict) else None
    return state if isinstance(state, str) and state else None


def _shader_size(sections: Mapping[str, Any]) -> int | None:
    infos = sections.get("Shader infos")
    info = infos.get("Info") if isinstance(infos, dict) else None
    if isinstance(info, list):
        info = info[0] if info else None
    size = info.get("Shader size") if isinstance(info, dict) else None
    return size if isinstance(size, int) else None


def _generation_name(gpu_state: Mapping[str, Any]) -> str | None:
    gpus = gpu_state.get("gpus") or []
    if gpus and isinstance(gpus[0], dict):
        return gpus[0].get("generation_name")
    return None


def _faulting_resource(fault: Mapping[str, Any]) -> dict[str, Any]:
    resources = fault.get("resources") or []
    named = [r for r in resources if isinstance(r, dict)]
    for r in named:
        if r.get("debug_name") or r.get("was_destroyed"):
            return r
    return named[0] if named else {}


def _find_unreal_xml(sections: Mapping[str, Any]) -> str | None:
    for value in sections.values():
        if isinstance(value, str) and "FGenericCrashContext" in value:
            return value
    return None


def _unreal_context(sections: Mapping[str, Any]) -> dict[str, Any]:
    xml = _find_unreal_xml(sections)
    if not xml:
        return {}
    out: dict[str, Any] = {}
    for tag, key in _UNREAL_FIELDS.items():
        match = re.search(rf"<{re.escape(tag)}>(.*?)</{re.escape(tag)}>", xml, re.DOTALL)
        if not match:
            continue
        value = _xml_unescape(match.group(1).strip(), {"&quot;": '"', "&apos;": "'"})
        if not value:
            continue
        if key in _UNREAL_BOOL_KEYS:
            out[key] = value.lower() == "true"
        elif key in _UNREAL_INT_KEYS and value.isdigit():
            out[key] = int(value)
        else:
            out[key] = value
    return out


def _build_gpu_crash_context(response: Mapping[str, Any]) -> dict[str, Any]:
    fault = response.get("fault") or {}
    gpu_state = response.get("gpu_state") or {}
    primary_shader = _primary_shader(response)
    frames = response.get("frames") or []
    primary_frame = frames[0] if frames and isinstance(frames[0], dict) else {}
    resource = _faulting_resource(fault)
    sections = _raw_sections(response)
    faulted = _faulted_warps(sections)
    first_faulted = faulted[0] if faulted else {}

    flat: dict[str, Any] = {
        "type": "gpu_crash",
        "fault_category": response.get("fault_category"),
        "fault_type": fault.get("type"),
        "fault_code": fault.get("code"),
        "fault_description": fault.get("description"),
        "last_gpu_operation": _last_gpu_operation(response),
        "virtual_address": fault.get("virtual_address"),
        "access_type": fault.get("access_type"),
        "engine": fault.get("engine"),
        "client": fault.get("client"),
        "device_status": gpu_state.get("device_status"),
        "device_state": _device_state(sections),
        "engine_reset": gpu_state.get("engine_reset"),
        "adapter_reset": gpu_state.get("adapter_reset"),
        "active_warps": _warp_count(sections),
        "faulting_pc": primary_frame.get("instruction_addr"),
        "fault_name": first_faulted.get("fault_name"),
        "fault_detail": first_faulted.get("fault_detail"),
        "resource": resource.get("debug_name"),
        "resource_destroyed": resource.get("was_destroyed") or None,
        "shader_hash": primary_shader.get("shader_hash"),
        "shader_type": primary_shader.get("shader_type"),
        "shader_size": _shader_size(sections),
        "shader_debug_info_uid": primary_shader.get("shader_debug_info_uid"),
        "status": response.get("status"),
        "handler": response.get("handler"),
        "sdk_version": response.get("sdk_version"),
        "decode_time_ms": response.get("decode_time_ms"),
        "missing_dif_count": len(response.get("missing_difs") or []),
    }
    out = {k: v for k, v in flat.items() if v is not None}
    if faulted:
        out["faulted_warps"] = faulted
    warnings = response.get("warnings") or []
    if warnings:
        out["warnings"] = warnings
    return out


def _merge_tags(existing: Any, extra: Mapping[str, str]) -> list[tuple[str, str]]:
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
    out: list[dict[str, Any]] = []
    for m in markers:
        if not isinstance(m, dict):
            continue
        kind = m.get("kind") or "marker"
        label = m.get("label") or kind
        data = m.get("data")

        if isinstance(data, str) and "FGenericCrashContext" in data:
            continue

        text = _decode_data_chunk(data) if isinstance(data, dict) else None
        if text:
            event = data.get("Event") or {} if isinstance(data, dict) else {}
            info = {k: event.get(k) for k in ("Pipe", "Status", "Type") if event.get(k)}
            out.append(
                {
                    "category": "gpu.marker",
                    "message": text[:512],
                    "type": "info",
                    "level": "info",
                    "data": info or None,
                }
            )
            continue

        stack = _marker_callstack(data)
        if stack:
            out.append(
                {
                    "category": "gpu.marker.callstack",
                    "message": f"GPU marker callstack ({len(stack)} frames)",
                    "type": "info",
                    "level": "info",
                    "data": {"frames": stack},
                }
            )
            continue

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
