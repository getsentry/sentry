"""
Pure unit tests for teapot integration. Do not require fixtures or a live
service. End-to-end tests live under tests/sentry/lang/native/test_gpu_crash_full.py
(Phase 2) and tests/symbolicator/ (Phase 3, when the full ingest path is wired).
"""

from __future__ import annotations

import contextlib
from collections.abc import Iterator
from typing import Any
from unittest import mock

import pytest
import requests

from sentry.lang.native.processing import (
    GPU_CRASH_DUMP_ATTACHMENT_TYPE,
    _merge_gpu_response,
    process_gpu_crash_dump,
)
from sentry.lang.native.teapot import (
    TeapotClient,
    TeapotUnavailable,
    submit_to_teapot,
)


# A `(sources, process_response)` tuple shaped like `sources_for_symbolication`
# returns. `process_response` must be idempotent so the tests stay readable.
def _fake_sources_for_symbolication(_project: Any) -> tuple[list[dict[str, Any]], Any]:
    sources: list[dict[str, Any]] = [{"type": "sentry", "id": "sentry:project"}]

    def _process(payload: dict[str, Any]) -> dict[str, Any]:
        return payload

    return sources, _process


class _FakeProject:
    def __init__(self, id: int = 42, organization_id: int = 7) -> None:
        self.id = id
        self.organization_id = organization_id


class _FakeResponse:
    def __init__(self, status_code: int, body: Any = None, raise_on_json: bool = False) -> None:
        self.status_code = status_code
        self._body = body if body is not None else {}
        self.text = "" if isinstance(body, dict) or body is None else str(body)
        self._raise_on_json = raise_on_json

    def json(self) -> Any:
        if self._raise_on_json:
            raise ValueError("not JSON")
        return self._body


# ---------------------------------------------------------------------------
# _merge_gpu_response
# ---------------------------------------------------------------------------


def test_merge_gpu_response_writes_context() -> None:
    data: dict[str, Any] = {}
    response = {
        "status": "completed",
        "handler": "aftermath",
        "sdk_version": "2025.5.0",
        "decode_time_ms": 241,
        "fault": {"type": "PageFault", "code": "FOO", "virtual_address": "0xdeadbeef"},
        "gpu_state": {"device_name": "Test GPU"},
        "shader_context": {"shader_hash": "abc123", "entry_point": "Main"},
        "frames": [{"function": "main", "module": "abc123"}],
        "missing_difs": [],
    }

    _merge_gpu_response(data, response)

    ctx = data["contexts"]["gpu_crash"]
    assert ctx["status"] == "completed"
    assert ctx["handler"] == "aftermath"
    assert ctx["sdk_version"] == "2025.5.0"
    # Flat shape: UI-friendly top-level scalars instead of nested blobs.
    assert ctx["fault_type"] == "PageFault"
    assert ctx["device_name"] == "Test GPU"
    assert ctx["shader_hash"] == "abc123"
    # Nested fault/gpu_state/shader_context do not appear on the flat context.
    assert "fault" not in ctx
    assert "gpu_state" not in ctx
    assert "shader_context" not in ctx
    # Empty missing_difs surfaces as a zero count rather than a list.
    assert ctx["missing_dif_count"] == 0

    # Raw nested blobs still available under gpu_crash_raw (hidden in UI).
    raw = data["contexts"]["gpu_crash_raw"]
    assert raw["type"] == "default"
    assert raw["fault"]["type"] == "PageFault"
    assert raw["gpu_state"]["device_name"] == "Test GPU"
    assert raw["shader_context"]["shader_hash"] == "abc123"

    # Frames go to the private channel, not user-visible context.
    assert data["_gpu_crash_private"]["frames"] == [{"function": "main", "module": "abc123"}]
    assert "frames" not in ctx


def test_merge_gpu_response_preserves_trace_id() -> None:
    trace_id = "aabbccddeeff00112233445566778899"
    data: dict[str, Any] = {
        "contexts": {"trace": {"trace_id": trace_id, "span_id": "0011223344556677"}},
    }
    response = {
        "status": "partial",
        "fault": {"type": "PageFault"},
    }

    _merge_gpu_response(data, response)

    # The trace context is untouched. This is the whole point of keeping the
    # GPU merge additive.
    assert data["contexts"]["trace"]["trace_id"] == trace_id
    assert data["contexts"]["trace"]["span_id"] == "0011223344556677"
    assert data["contexts"]["gpu_crash"]["status"] == "partial"


def test_merge_gpu_response_failed_status() -> None:
    data: dict[str, Any] = {}
    response = {
        "status": "failed",
        "handler": "aftermath",
        "error": {"code": "DUMP_CORRUPTED", "message": "..."},
    }

    _merge_gpu_response(data, response)

    ctx = data["contexts"]["gpu_crash"]
    assert ctx["status"] == "failed"
    assert ctx["error"]["code"] == "DUMP_CORRUPTED"
    assert ctx["handler"] == "aftermath"
    # No fault / gpu_state / frames — failed decode has nothing to merge.
    assert "fault" not in ctx
    assert "_gpu_crash_private" not in data


def test_merge_gpu_response_omits_missing_sections() -> None:
    data: dict[str, Any] = {}
    response = {
        "status": "completed",
        # fault / gpu_state / shader_context intentionally absent
    }

    _merge_gpu_response(data, response)

    ctx = data["contexts"]["gpu_crash"]
    assert ctx["status"] == "completed"
    # Absent sections don't get written as empty dicts — the flat context
    # drops None-valued keys so the UI doesn't render empty rows.
    assert "fault" not in ctx
    assert "gpu_state" not in ctx
    assert "shader_context" not in ctx
    assert "device_name" not in ctx
    assert "shader_hash" not in ctx
    # Fault type falls back to a generic label when teapot reports nothing.
    assert ctx["fault_type"] == "GPU crash"


def test_merge_gpu_response_preserves_exception() -> None:
    """Primary CPU exception must not be touched by GPU merge."""

    cpu_exception = {
        "values": [{"type": "ACCESS_VIOLATION", "value": "CPU crash", "stacktrace": {"frames": []}}]
    }
    data: dict[str, Any] = {
        "exception": cpu_exception,
        "platform": "native",
    }
    response = {
        "status": "completed",
        "fault": {"type": "PageFault"},
        "frames": [{"function": "shader_main"}],
    }

    _merge_gpu_response(data, response)

    assert data["exception"] is cpu_exception
    assert data["platform"] == "native"


# ---------------------------------------------------------------------------
# TeapotClient
# ---------------------------------------------------------------------------


@contextlib.contextmanager
def _configured_teapot(url: str = "http://teapot.test") -> Iterator[None]:
    """Context manager: sets TEAPOT_URL and stubs `sources_for_symbolication`."""

    from django.conf import settings

    with (
        mock.patch.object(settings, "TEAPOT_URL", url, create=True),
        mock.patch(
            "sentry.lang.native.teapot.sources_for_symbolication",
            _fake_sources_for_symbolication,
        ),
    ):
        yield


def test_client_success() -> None:
    project = _FakeProject()
    expected = {"status": "completed", "handler": "aftermath", "fault": {"type": "PageFault"}}

    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.return_value = _FakeResponse(200, expected)

        result = TeapotClient(project, "abc").symbolicate(b"dummy-dump-bytes")

    assert result == expected
    assert mock_post.call_count == 1
    args, kwargs = mock_post.call_args
    assert args[0] == "http://teapot.test/symbolicate"
    # Multipart fields carry the identifiers teapot needs to cache-key correctly.
    assert kwargs["data"]["event_id"] == "abc"
    assert kwargs["data"]["project_id"] == "42"
    assert kwargs["data"]["organization_id"] == "7"
    # sources is JSON-serialized.
    assert '"sentry:project"' in kwargs["data"]["sources"]
    # Dump arrives as a file, not a plain string.
    assert "upload_file" in kwargs["files"]
    assert kwargs["files"]["upload_file"][1] == b"dummy-dump-bytes"
    assert kwargs["headers"]["X-Teapot-Version"] == "1"
    assert kwargs["headers"]["X-Request-Id"] == "abc"


def test_client_retries_on_503() -> None:
    project = _FakeProject()

    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.side_effect = [
            _FakeResponse(503),
            _FakeResponse(200, {"status": "partial"}),
        ]

        result = TeapotClient(project, "abc").symbolicate(b"dump")

    assert result == {"status": "partial"}
    assert mock_post.call_count == 2


def test_client_retries_on_network_error() -> None:
    project = _FakeProject()

    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.side_effect = [
            requests.ConnectionError("boom"),
            _FakeResponse(200, {"status": "completed"}),
        ]

        result = TeapotClient(project, "abc").symbolicate(b"dump")

    assert result == {"status": "completed"}
    assert mock_post.call_count == 2


def test_client_exhausts_retries() -> None:
    project = _FakeProject()

    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.return_value = _FakeResponse(503)

        with pytest.raises(TeapotUnavailable):
            TeapotClient(project, "abc").symbolicate(b"dump")

    assert mock_post.call_count == 3


def test_client_400_is_not_retried() -> None:
    project = _FakeProject()

    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.return_value = _FakeResponse(400, "bad request")

        with pytest.raises(TeapotUnavailable):
            TeapotClient(project, "abc").symbolicate(b"dump")

    assert mock_post.call_count == 1


def test_client_non_json_body() -> None:
    project = _FakeProject()

    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.return_value = _FakeResponse(200, "not-json", raise_on_json=True)

        with pytest.raises(TeapotUnavailable):
            TeapotClient(project, "abc").symbolicate(b"dump")


def test_client_missing_url_raises() -> None:
    from django.conf import settings

    with (
        mock.patch.object(settings, "TEAPOT_URL", None, create=True),
        mock.patch(
            "sentry.lang.native.teapot.options.get",
            lambda key: {} if key == "teapot.options" else None,
        ),
    ):
        with pytest.raises(TeapotUnavailable):
            TeapotClient(_FakeProject(), "abc")


def test_client_falls_back_to_options() -> None:
    from django.conf import settings

    project = _FakeProject()
    with (
        mock.patch.object(settings, "TEAPOT_URL", None, create=True),
        mock.patch(
            "sentry.lang.native.teapot.options.get",
            lambda key: (
                {"url": "http://teapot-from-options.test"} if key == "teapot.options" else None
            ),
        ),
        mock.patch(
            "sentry.lang.native.teapot.sources_for_symbolication",
            _fake_sources_for_symbolication,
        ),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.return_value = _FakeResponse(200, {"status": "completed"})
        TeapotClient(project, "abc").symbolicate(b"dump")

    assert mock_post.call_args[0][0] == "http://teapot-from-options.test/symbolicate"


# ---------------------------------------------------------------------------
# submit_to_teapot (best-effort wrapper)
# ---------------------------------------------------------------------------


def test_submit_to_teapot_success() -> None:
    project = _FakeProject()
    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.return_value = _FakeResponse(200, {"status": "completed"})
        assert submit_to_teapot(project, "abc", b"dump") == {"status": "completed"}


def test_submit_to_teapot_returns_none_when_unavailable() -> None:
    from django.conf import settings

    with (
        mock.patch.object(settings, "TEAPOT_URL", None, create=True),
        mock.patch(
            "sentry.lang.native.teapot.options.get",
            lambda key: None,
        ),
    ):
        assert submit_to_teapot(_FakeProject(), "abc", b"dump") is None


def test_submit_to_teapot_swallows_unexpected() -> None:
    project = _FakeProject()
    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.TeapotClient") as mock_client,
        mock.patch("sentry.lang.native.teapot.sentry_sdk.capture_exception") as cap,
    ):
        mock_client.return_value.symbolicate.side_effect = RuntimeError("unexpected")
        assert submit_to_teapot(project, "abc", b"dump") is None
        cap.assert_called_once()


# ---------------------------------------------------------------------------
# process_gpu_crash_dump
# ---------------------------------------------------------------------------


class _FakeAttachment:
    def __init__(self, data: bytes, attachment_type: str) -> None:
        self._data = data
        self.type = attachment_type

    def load_data(self, _project: Any) -> bytes:
        return self._data


def test_process_gpu_crash_dump_no_attachment_returns_unchanged() -> None:
    data: dict[str, Any] = {"some": "thing"}
    project = _FakeProject()

    with mock.patch(
        "sentry.lang.native.utils.find_gpu_crash_dump_attachment",
        return_value=None,
    ):
        result = process_gpu_crash_dump(data, project, "abc")

    assert result is data
    assert "contexts" not in data


def test_process_gpu_crash_dump_teapot_unavailable_returns_unchanged() -> None:
    data: dict[str, Any] = {}
    project = _FakeProject()
    attachment = _FakeAttachment(b"dump", GPU_CRASH_DUMP_ATTACHMENT_TYPE)

    with (
        mock.patch(
            "sentry.lang.native.utils.find_gpu_crash_dump_attachment",
            return_value=attachment,
        ),
        mock.patch(
            "sentry.lang.native.teapot.submit_to_teapot",
            return_value=None,
        ),
    ):
        result = process_gpu_crash_dump(data, project, "abc")

    assert result is data
    assert "contexts" not in data


def test_process_gpu_crash_dump_success_populates_context() -> None:
    data: dict[str, Any] = {
        "event_id": "ev-1",
        "contexts": {"trace": {"trace_id": "x" * 32}},
    }
    project = _FakeProject()
    attachment = _FakeAttachment(b"dump", GPU_CRASH_DUMP_ATTACHMENT_TYPE)
    response = {
        "status": "partial",
        "handler": "aftermath",
        "fault": {"type": "PageFault"},
        "shader_context": {"shader_hash": "sh1"},
        "frames": [{"function": "main"}],
        "missing_difs": [{"debug_id": "x"}],
    }

    with (
        mock.patch(
            "sentry.lang.native.utils.find_gpu_crash_dump_attachment",
            return_value=attachment,
        ),
        mock.patch(
            "sentry.lang.native.teapot.submit_to_teapot",
            return_value=response,
        ),
        # Don't actually fire Kafka in this test — exercised separately below.
        mock.patch("sentry.issues.producer.produce_occurrence_to_kafka"),
    ):
        result = process_gpu_crash_dump(data, project, "ev-1")

    assert result is data
    assert data["contexts"]["gpu_crash"]["status"] == "partial"
    assert data["contexts"]["gpu_crash"]["fault_type"] == "PageFault"
    assert data["contexts"]["gpu_crash_raw"]["fault"]["type"] == "PageFault"
    # Trace preserved.
    assert data["contexts"]["trace"]["trace_id"] == "x" * 32
    # Frames stashed privately.
    assert data["_gpu_crash_private"]["frames"] == [{"function": "main"}]


# ---------------------------------------------------------------------------
# IssueOccurrence production (Phase 2)
# ---------------------------------------------------------------------------


def test_occurrence_fired_on_completed_status() -> None:
    data: dict[str, Any] = {
        "event_id": "ev-1",
        "contexts": {"trace": {"trace_id": "x" * 32}},
    }
    project = _FakeProject()
    attachment = _FakeAttachment(b"dump", GPU_CRASH_DUMP_ATTACHMENT_TYPE)
    response = {
        "status": "completed",
        "handler": "aftermath",
        "fault": {"type": "PageFault", "virtual_address": "0xdeadbeef"},
        "shader_context": {
            "shader_hash": "abc123",
            "entry_point": "ComputeLighting",
            "source_language": "HLSL",
        },
        "frames": [{"function": "ComputeLighting", "lineno": 142}],
        "missing_difs": [],
    }

    with (
        mock.patch(
            "sentry.lang.native.utils.find_gpu_crash_dump_attachment",
            return_value=attachment,
        ),
        mock.patch(
            "sentry.lang.native.teapot.submit_to_teapot",
            return_value=response,
        ),
        mock.patch(
            "sentry.lang.native.gpu._get_or_create_gpu_detector_id",
            return_value=None,
        ),
        mock.patch("sentry.issues.producer.produce_occurrence_to_kafka") as mock_produce,
    ):
        process_gpu_crash_dump(data, project, "ev-1")

    assert mock_produce.call_count == 1
    kwargs = mock_produce.call_args.kwargs
    occ = kwargs["occurrence"]

    # Fingerprint: stable across the same fault + shader.
    assert occ.fingerprint == ["gpu-crash:PageFault:abc123"]
    # Occurrence references a FRESH event, not the CPU minidump event, so
    # the issue detail page can render GPU frames instead of the CPU stack.
    # Both events share the trace_id via contexts.trace.
    assert occ.event_id != "ev-1"
    assert len(occ.event_id) == 32  # uuid hex
    assert occ.project_id == project.id
    assert occ.level == "fatal"
    assert "PageFault" in occ.issue_title
    assert "ComputeLighting" in occ.issue_title
    assert occ.culprit == "ComputeLighting"

    # The GPU crash type must be the 9001 GroupType.
    from sentry.lang.native.grouptype import GpuCrashGroupType

    assert occ.type is GpuCrashGroupType

    # The event payload forwarded to Kafka is the fresh GPU event — matching
    # the occurrence's event_id, platform native, and carrying the GPU
    # stacktrace at the top level (not under `exception`, which the
    # occurrence consumer strips).
    event_payload = kwargs["event_data"]
    assert event_payload["event_id"] == occ.event_id
    assert event_payload["platform"] == "native"
    assert "_gpu_crash_private" not in event_payload
    # The GPU stack is what the issue detail page will render.
    stacktrace_frames = event_payload["stacktrace"]["frames"]
    assert stacktrace_frames[0]["function"] == "ComputeLighting"
    # Back-reference + trace continuation so both events co-locate in trace view.
    assert event_payload["tags"]["cpu_event_id"] == "ev-1"
    assert event_payload["contexts"]["trace"]["trace_id"] == "x" * 32
    # gpu_crash context is flattened — fault fields hoisted to top-level scalars.
    assert event_payload["contexts"]["gpu_crash"]["fault_type"] == "PageFault"
    assert event_payload["contexts"]["gpu_crash"]["shader_hash"] == "abc123"
    # Full nested blob still available under gpu_crash_raw for deep inspection.
    assert event_payload["contexts"]["gpu_crash_raw"]["fault"]["type"] == "PageFault"


def test_occurrence_fingerprint_groups_by_shader_and_fault() -> None:
    """Two crashes of the same shader + fault produce the same fingerprint."""

    from sentry.lang.native.gpu import _produce_gpu_occurrence

    project = _FakeProject()

    response_a = {
        "status": "completed",
        "fault": {"type": "PageFault"},
        "shader_context": {"shader_hash": "sh1", "entry_point": "Main"},
    }
    response_b = {
        "status": "completed",
        "fault": {"type": "PageFault"},
        "shader_context": {"shader_hash": "sh1", "entry_point": "Main"},
    }
    response_c_diff_shader = {
        "status": "completed",
        "fault": {"type": "PageFault"},
        "shader_context": {"shader_hash": "sh2", "entry_point": "Main"},
    }

    fingerprints: list[list[str]] = []

    def _capture(**kwargs: Any) -> None:
        fingerprints.append(list(kwargs["occurrence"].fingerprint))

    with mock.patch(
        "sentry.issues.producer.produce_occurrence_to_kafka",
        side_effect=_capture,
    ):
        _produce_gpu_occurrence({"event_id": "a"}, project, "a", response_a)
        _produce_gpu_occurrence({"event_id": "b"}, project, "b", response_b)
        _produce_gpu_occurrence({"event_id": "c"}, project, "c", response_c_diff_shader)

    assert fingerprints[0] == fingerprints[1]  # same shader + fault → grouped
    assert fingerprints[0] != fingerprints[2]  # different shader → separate


def test_occurrence_not_fired_on_failed_status() -> None:
    """`failed` status means teapot couldn't decode. No fingerprint → no issue."""

    data: dict[str, Any] = {"event_id": "ev-1"}
    project = _FakeProject()
    attachment = _FakeAttachment(b"dump", GPU_CRASH_DUMP_ATTACHMENT_TYPE)
    response = {"status": "failed", "error": {"code": "DUMP_CORRUPTED"}}

    with (
        mock.patch(
            "sentry.lang.native.utils.find_gpu_crash_dump_attachment",
            return_value=attachment,
        ),
        mock.patch(
            "sentry.lang.native.teapot.submit_to_teapot",
            return_value=response,
        ),
        mock.patch("sentry.issues.producer.produce_occurrence_to_kafka") as mock_produce,
    ):
        process_gpu_crash_dump(data, project, "ev-1")

    # Context still populated, but no occurrence — a failed decode can't be
    # meaningfully grouped or reasoned about.
    assert data["contexts"]["gpu_crash"]["status"] == "failed"
    assert mock_produce.call_count == 0


def test_occurrence_producer_error_is_swallowed() -> None:
    """Issue platform errors must never fail the primary CPU event."""

    data: dict[str, Any] = {"event_id": "ev-1"}
    project = _FakeProject()
    attachment = _FakeAttachment(b"dump", GPU_CRASH_DUMP_ATTACHMENT_TYPE)
    response = {
        "status": "completed",
        "fault": {"type": "PageFault"},
        "shader_context": {"shader_hash": "sh1"},
    }

    with (
        mock.patch(
            "sentry.lang.native.utils.find_gpu_crash_dump_attachment",
            return_value=attachment,
        ),
        mock.patch(
            "sentry.lang.native.teapot.submit_to_teapot",
            return_value=response,
        ),
        # Skip the real Detector.objects.get_or_create call which would raise
        # TypeError on our _FakeProject and double-count the capture_exception.
        mock.patch(
            "sentry.lang.native.gpu._get_or_create_gpu_detector_id",
            return_value=None,
        ),
        mock.patch(
            "sentry.issues.producer.produce_occurrence_to_kafka",
            side_effect=RuntimeError("kafka broken"),
        ),
        mock.patch("sentry.lang.native.gpu.sentry_sdk.capture_exception") as cap,
    ):
        # No exception propagates.
        result = process_gpu_crash_dump(data, project, "ev-1")

    assert result is data
    assert data["contexts"]["gpu_crash"]["status"] == "completed"
    cap.assert_called_once()


def test_grouptype_registered_at_import_time() -> None:
    """Just importing the grouptype module must register it."""

    from sentry.issues.grouptype import registry
    from sentry.lang.native.grouptype import GpuCrashGroupType

    assert registry.get_by_type_id(GpuCrashGroupType.type_id) is GpuCrashGroupType
    assert registry.get_by_slug("gpu_crash") is GpuCrashGroupType
