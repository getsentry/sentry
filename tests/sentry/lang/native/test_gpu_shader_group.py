from __future__ import annotations

from collections.abc import MutableMapping
from typing import Any

from sentry.constants import MAX_CULPRIT_LENGTH, MAX_TAG_VALUE_LENGTH
from sentry.lang.native.gpu import apply_gpu_crash_symbolication

MATERIAL_GROUP = "M_GpuHang_992b2d801a2e9ddf/Default/FLocalVertexFactory/FLumenCardPS/0"
GLOBAL_GROUP = "Global/FHeavyComputeLoop/0"


def _response(frame: dict[str, Any]) -> dict[str, Any]:
    return {
        "status": "completed",
        "handler": "aftermath",
        "fault_category": "shader_hang",
        "title": "GPU hang in Main",
        "fingerprint": ["gpu", "shader_hang", "49478268ce7710e2"],
        "markers": [],
        "fault": {"type": "Timeout"},
        "gpu_state": {"device_name": "GA102-A"},
        "shader_context": {
            "active_shaders": [{"shader_hash": "49478268ce7710e2", "shader_type": "Pixel"}]
        },
        "frames": [frame],
        "missing_difs": [],
    }


def _apply(frame: dict[str, Any]) -> MutableMapping[str, Any]:
    data: dict[str, Any] = {"event_id": "g" * 32, "platform": "native"}
    result = apply_gpu_crash_symbolication(data, _response(frame))
    assert result is not None
    return result


def _frame(**overrides: Any) -> dict[str, Any]:
    frame = {
        "function": "Main",
        "module": MATERIAL_GROUP,
        "data": {"shader_hash": "49478268ce7710e2", "shader_group": MATERIAL_GROUP},
    }
    frame.update(overrides)
    return frame


def test_material_group_fills_tags_culprit_and_context() -> None:
    data = _apply(_frame())

    tags = dict(data["tags"])
    assert tags["gpu.shader_group"] == MATERIAL_GROUP
    assert tags["gpu.material"] == "M_GpuHang_992b2d801a2e9ddf"
    assert tags["gpu.shader_class"] == "FLumenCardPS"
    assert data["culprit"] == MATERIAL_GROUP

    gpu_crash = data["contexts"]["gpu_crash"]
    assert gpu_crash["shader_group"] == MATERIAL_GROUP
    assert gpu_crash["material"] == "M_GpuHang_992b2d801a2e9ddf"
    assert gpu_crash["shader_class"] == "FLumenCardPS"


def test_long_group_is_truncated_for_culprit_and_tags() -> None:
    group = "M_" + "x" * 600 + "/Default/FLocalVertexFactory/FLumenCardPS/0"
    data = _apply(
        _frame(module=group, data={"shader_hash": "49478268ce7710e2", "shader_group": group})
    )

    assert len(data["culprit"]) <= MAX_CULPRIT_LENGTH
    assert data["culprit"].startswith("M_xxx")
    tags = dict(data["tags"])
    assert len(tags["gpu.shader_group"]) <= MAX_TAG_VALUE_LENGTH
    assert len(tags["gpu.material"]) <= MAX_TAG_VALUE_LENGTH
    assert tags["gpu.material"].startswith("M_xxx")
    assert tags["gpu.shader_class"] == "FLumenCardPS"
    assert data["contexts"]["gpu_crash"]["shader_group"] == group


def test_global_group_has_no_material() -> None:
    data = _apply(_frame(module=GLOBAL_GROUP, data={"shader_group": GLOBAL_GROUP}))

    tags = dict(data["tags"])
    assert tags["gpu.shader_group"] == GLOBAL_GROUP
    assert tags["gpu.shader_class"] == "FHeavyComputeLoop"
    assert "gpu.material" not in tags
    assert "material" not in data["contexts"]["gpu_crash"]


def test_group_fills_the_empty_filename_slot() -> None:
    data = _apply(_frame())

    (applied,) = data["exception"]["values"][0]["stacktrace"]["frames"]
    assert applied["filename"] == MATERIAL_GROUP


def test_real_filename_is_kept() -> None:
    data = _apply(_frame(filename="/Game/Shaders/Foo.usf", lineno=12))

    (applied,) = data["exception"]["values"][0]["stacktrace"]["frames"]
    assert applied["filename"] == "/Game/Shaders/Foo.usf"


def test_no_group_changes_nothing() -> None:
    data = _apply({"function": "compute_01", "module": "shader_658794f3a75293d1", "data": {}})

    tags = dict(data["tags"])
    assert "gpu.shader_group" not in tags and "gpu.material" not in tags
    assert "culprit" not in data
    assert "shader_group" not in data["contexts"]["gpu_crash"]
    (applied,) = data["exception"]["values"][0]["stacktrace"]["frames"]
    assert "filename" not in applied


def _apply_page_fault(frames: list[dict[str, Any]]) -> MutableMapping[str, Any]:
    response = _response(frames[0])
    response.update(
        fault_category="page_fault",
        frames=frames,
        shader_context={
            "active_shaders": [
                {"shader_hash": frame["data"]["shader_hash"], "shader_type": "Compute"}
                for frame in frames
            ]
        },
    )
    data: dict[str, Any] = {"event_id": "g" * 32, "platform": "native"}
    result = apply_gpu_crash_symbolication(data, response)
    assert result is not None
    return result


def test_page_fault_takes_the_group_of_the_faulted_frame() -> None:
    running = _frame(data={"shader_hash": "1111111111111111", "shader_group": GLOBAL_GROUP})
    faulted = _frame(
        instruction_addr="0x50",
        data={"shader_hash": "49478268ce7710e2", "shader_group": MATERIAL_GROUP, "faulted": True},
    )
    data = _apply_page_fault([running, faulted])

    tags = dict(data["tags"])
    assert tags["gpu.shader_group"] == MATERIAL_GROUP
    assert tags["gpu.shader_hash"] == "49478268ce7710e2"
    assert data["culprit"] == MATERIAL_GROUP
    assert data["contexts"]["gpu_crash"]["faulting_pc"] == "0x50"


def test_page_fault_without_a_faulted_frame_names_no_shader() -> None:
    running = _frame(data={"shader_hash": "49478268ce7710e2", "shader_group": MATERIAL_GROUP})
    data = _apply_page_fault([running])

    tags = dict(data["tags"])
    assert "gpu.shader_group" not in tags and "gpu.shader_hash" not in tags
    assert "culprit" not in data
    assert "shader_group" not in data["contexts"]["gpu_crash"]


def test_decoder_name_is_kept_as_raw_function() -> None:
    data = _apply(_frame(raw_function="fragment_01"))

    (applied,) = data["exception"]["values"][0]["stacktrace"]["frames"]
    assert applied["function"] == "Main"
    assert applied["raw_function"] == "fragment_01"
