from __future__ import annotations

from typing import Any

import pytest

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


def _apply(frame: dict[str, Any]) -> dict[str, Any]:
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


def test_global_group_has_no_material() -> None:
    data = _apply(_frame(module=GLOBAL_GROUP, data={"shader_group": GLOBAL_GROUP}))

    tags = dict(data["tags"])
    assert tags["gpu.shader_group"] == GLOBAL_GROUP
    assert tags["gpu.shader_class"] == "FHeavyComputeLoop"
    assert "gpu.material" not in tags
    assert "material" not in data["contexts"]["gpu_crash"]


@pytest.mark.parametrize(
    ("filename", "expected_abs_path"),
    [(None, None), ("__UE_FILENAME_SENTINEL", "__UE_FILENAME_SENTINEL")],
)
def test_group_fills_the_filename_slot(filename: str | None, expected_abs_path: str | None) -> None:
    frame = _frame(lineno=3477) if filename is None else _frame(filename=filename, lineno=3477)
    data = _apply(frame)

    (applied,) = data["exception"]["values"][0]["stacktrace"]["frames"]
    assert applied["filename"] == MATERIAL_GROUP
    assert applied.get("abs_path") == expected_abs_path
    assert applied["lineno"] == 3477


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
