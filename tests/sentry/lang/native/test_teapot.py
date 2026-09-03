"""
Unit tests for the teapot client + GPU event enrichment.
"""

from __future__ import annotations

import contextlib
import hashlib
import hmac
from collections.abc import Iterator
from typing import Any
from unittest import mock

import orjson
import pytest
import requests

from sentry.lang.native.gpu import GPU_CRASH_DUMP_ATTACHMENT_TYPE, apply_gpu_crash_symbolication
from sentry.lang.native.teapot import (
    TeapotClient,
    TeapotRequestError,
    TeapotUnavailable,
    _uid_from_nvdbg_filename,
    submit_to_teapot,
)


class _FakeProject:
    def __init__(self, id: int = 42, organization_id: int = 7) -> None:
        self.id = id
        self.organization_id = organization_id


class _FakeAttachment:
    def __init__(
        self,
        data: bytes = b"",
        attachment_type: str = GPU_CRASH_DUMP_ATTACHMENT_TYPE,
        name: str = "dump.nv-gpudmp",
        stored_id: str | None = "obj-id",
    ) -> None:
        self.type = attachment_type
        self.name = name
        self.stored_id = stored_id


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


def _completed_response(**overrides: Any) -> dict[str, Any]:
    """Minimal `status=completed` teapot response with the new top-level fields.

    Tests that care about a specific field can override individual keys.
    """

    base: dict[str, Any] = {
        "status": "completed",
        "handler": "aftermath",
        "sdk_version": "2025.5.0",
        "decode_time_ms": 241,
        "fault_category": "shader_hang",
        "title": "GPU hang in vertex_02",
        "fingerprint": ["gpu", "shader_hang", "abc123"],
        "markers": [],
        "fault": {"type": "Timeout"},
        "gpu_state": {"device_name": "RTX 4090"},
        "shader_context": {
            "active_shaders": [{"shader_hash": "abc123", "shader_type": "Vertex"}],
        },
        "frames": [{"function": "Vertex", "module": "shader_abc123"}],
        "missing_difs": [],
    }
    base.update(overrides)
    return base


@contextlib.contextmanager
def _configured_teapot(url: str = "http://teapot.test") -> Iterator[None]:
    """Context manager: sets SENTRY_TEAPOT_URL so the client resolves an endpoint."""

    from django.conf import settings

    with mock.patch.object(settings, "SENTRY_TEAPOT_URL", url, create=True):
        yield


@pytest.fixture(autouse=True)
def _skip_retry_backoff() -> Iterator[None]:
    """Skip the retry policy's inter-retry backoff sleep so retry tests stay instant."""
    with mock.patch("sentry.utils.retries.time.sleep"):
        yield


@pytest.fixture(autouse=True)
def mock_objectstore() -> Iterator[mock.Mock]:
    # teapot presigns each attachment via objectstore.get_internal_download_url.
    get_url = mock.Mock(side_effect=lambda _session, key: f"http://objectstore/{key}?sig=abc")
    with (
        mock.patch("sentry.lang.native.teapot.get_session", return_value=mock.Mock()),
        mock.patch("sentry.lang.native.teapot.get_internal_download_url", get_url),
    ):
        yield get_url


def _relay_gpu_event() -> dict[str, Any]:
    return {
        "event_id": "g" * 32,
        "platform": "native",
        "contexts": {"trace": {"trace_id": "a" * 32, "span_id": "b" * 16}},
        "release": "game@1.2.3",
        "environment": "prod",
        "tags": [["cpu_event_id", "cpu-1"]],
    }


def test_apply_gpu_crash_symbolication_shape() -> None:
    data = _relay_gpu_event()
    response = _completed_response(
        fault={"type": "PageFault", "virtual_address": "0xdeadbeef", "description": "write"},
        gpu_state={"device_name": "RTX 4090", "driver_version": "555.1", "api": "D3D12"},
        shader_context={"active_shaders": [{"shader_hash": "abc123", "shader_type": "Vertex"}]},
        frames=[{"function": "Vertex", "module": "shader_abc123"}],
    )

    out = apply_gpu_crash_symbolication(data, response)

    assert out is data  # mutated in place
    # teapot's fingerprint drives grouping.
    assert data["fingerprint"] == ["gpu", "shader_hang", "abc123"]
    # Relay-owned fields are preserved, not overwritten.
    assert data["contexts"]["trace"]["trace_id"] == "a" * 32
    # tags are the pipeline's list-of-pairs form; the Relay-set tag survives.
    tags = dict(data["tags"])
    assert tags["cpu_event_id"] == "cpu-1"
    assert data["release"] == "game@1.2.3"
    # teapot's decode is applied.
    assert data["level"] == "fatal"
    # Typed as an error so the title comes from the exception, not "<unlabeled event>".
    assert data["type"] == "error"
    exc = data["exception"]["values"][0]
    assert exc["type"] == "GPU hang in vertex_02"
    assert exc["mechanism"] == {"type": "gpu_crash", "handled": False}
    assert exc["stacktrace"]["frames"][0]["function"] == "Vertex"
    assert data["contexts"]["gpu_crash"]["fault_category"] == "shader_hang"
    assert tags["gpu.fault_category"] == "shader_hang"
    assert tags["gpu.shader_hash"] == "abc123"
    # Standard gpu context uses the schema's `api_type` field, not `api`.
    assert data["contexts"]["gpu"] == {
        "name": "RTX 4090",
        "driver_version": "555.1",
        "api_type": "D3D12",
    }


def test_apply_fingerprint_fallback() -> None:
    """A response without a fingerprint still groups deterministically."""
    data = _relay_gpu_event()
    apply_gpu_crash_symbolication(
        data, _completed_response(fingerprint=[], fault_category="page_fault")
    )
    assert data["fingerprint"] == ["gpu", "page_fault"]


def test_apply_handles_missing_optional_fields() -> None:
    """A minimal completed response (no gpu_state/frames/shader_context) still
    yields a valid event with sensible defaults."""
    data = _relay_gpu_event()
    out = apply_gpu_crash_symbolication(
        data, {"status": "completed", "fault_category": "page_fault"}
    )

    assert out is data
    assert data["type"] == "error"
    assert data["fingerprint"] == ["gpu", "page_fault"]
    exc = data["exception"]["values"][0]
    assert exc["type"] == "GPU crash (page_fault)"  # no title -> synthesized
    assert exc["stacktrace"]["frames"] == []
    assert data["contexts"]["gpu_crash"]["missing_dif_count"] == 0
    assert "gpu.shader_hash" not in dict(data["tags"])


def test_apply_skips_failed_status() -> None:
    data = _relay_gpu_event()
    out = apply_gpu_crash_symbolication(data, {"status": "failed"})

    assert out is None
    assert "exception" not in data
    assert "fingerprint" not in data


def test_apply_fills_os_from_gpu_state_as_raw_description() -> None:
    """With no SDK os scope, teapot's combined os string fills `raw_description`
    (not `name`, which drives OS filtering)."""
    data = _relay_gpu_event()  # no os context
    apply_gpu_crash_symbolication(
        data, _completed_response(gpu_state={"os_version": "Windows 10 (19H1)"})
    )
    assert data["contexts"]["os"] == {"raw_description": "Windows 10 (19H1)", "type": "os"}


def test_apply_merges_gpu_context_preserving_sdk_fields() -> None:
    """teapot overlays its crash-dump fields onto an SDK-provided gpu context
    without wiping SDK-only fields (memory_size, vendor_id)."""
    data = _relay_gpu_event()
    data["contexts"] = {"gpu": {"memory_size": 8192, "vendor_id": "0x10de", "name": "old"}}
    apply_gpu_crash_symbolication(
        data,
        _completed_response(gpu_state={"device_name": "RTX 4090", "api": "Vulkan"}),
    )
    gpu = data["contexts"]["gpu"]
    assert gpu["memory_size"] == 8192  # SDK-only field survives
    assert gpu["vendor_id"] == "0x10de"  # SDK-only field survives
    assert gpu["name"] == "RTX 4090"  # teapot's crash-dump value wins
    assert gpu["api_type"] == "Vulkan"


def test_apply_appends_markers_to_existing_breadcrumbs() -> None:
    """teapot markers append to (not replace) breadcrumbs already on the split event."""
    data = _relay_gpu_event()
    data["breadcrumbs"] = {"values": [{"category": "app.start", "message": "boot"}]}
    apply_gpu_crash_symbolication(
        data,
        _completed_response(markers=[{"kind": "draw", "label": "DrawIndexed", "data": {"n": 3}}]),
    )
    values = data["breadcrumbs"]["values"]
    assert values[0]["message"] == "boot"  # SDK breadcrumb preserved, still first
    assert values[-1]["category"] == "gpu.draw"  # GPU marker appended last


def test_apply_marker_without_data_omits_none_from_message() -> None:
    """A label-only marker (no data) renders just the label, not 'label: None'."""
    data = _relay_gpu_event()
    apply_gpu_crash_symbolication(
        data, _completed_response(markers=[{"kind": "barrier", "label": "PipelineBarrier"}])
    )
    bc = data["breadcrumbs"]["values"][0]
    assert bc["message"] == "PipelineBarrier"
    assert bc["data"] is None


# ---------------------------------------------------------------------------
# TeapotClient — request wire format
# ---------------------------------------------------------------------------


def test_client_sends_presigned_urls(mock_objectstore: mock.Mock) -> None:
    project = _FakeProject()
    dump = _FakeAttachment(stored_id="dump-obj-id")
    nvdbg = _FakeAttachment(
        attachment_type="event.nv_shader_debug",
        name="cafebabecafebabecafebabecafebabe.nvdbg",
        stored_id="nvdbg-obj-id",
    )

    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.return_value = _FakeResponse(200, _completed_response())
        TeapotClient(project, "abc").symbolicate(dump, [nvdbg])

    args, kwargs = mock_post.call_args
    assert args[0] == "http://teapot.test/symbolicate"
    assert kwargs.get("files") is None  # JSON, not multipart
    assert kwargs["headers"]["Content-Type"] == "application/json"
    assert kwargs["headers"]["Idempotency-Key"] == "abc"

    body = orjson.loads(kwargs["data"])
    assert body["event_id"] == "abc"
    assert body["project_id"] == "42"
    assert body["dump"] == {"storage_url": "http://objectstore/dump-obj-id?sig=abc"}
    assert "storage_token" not in body["dump"]
    shader = body["shader_debug_info"][0]
    assert shader["uid"] == "cafebabecafebabecafebabecafebabe"  # recovered from filename
    assert shader["storage_url"] == "http://objectstore/nvdbg-obj-id?sig=abc"

    # Both attachments (dump + shader) are presigned via the shared internal
    # objectstore helper, keyed by their stored_id.
    assert mock_objectstore.call_count == 2
    assert {call.args[1] for call in mock_objectstore.call_args_list} == {
        "dump-obj-id",
        "nvdbg-obj-id",
    }


def test_client_signs_request_when_secret_set(mock_objectstore: mock.Mock) -> None:
    from django.conf import settings

    with (
        _configured_teapot(),
        mock.patch.object(settings, "SENTRY_TEAPOT_SHARED_SECRET", "s3cr3t", create=True),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.return_value = _FakeResponse(200, _completed_response())
        TeapotClient(_FakeProject(), "abc").symbolicate(_FakeAttachment())

    kwargs = mock_post.call_args.kwargs
    # Signature is the HMAC-SHA256 of the exact body bytes sent.
    expected = hmac.new(b"s3cr3t", kwargs["data"], hashlib.sha256).hexdigest()
    assert kwargs["headers"]["Authorization"] == f"Rpcsignature rpc0:{expected}"


def test_client_unsigned_when_secret_unset(mock_objectstore: mock.Mock) -> None:
    from django.conf import settings

    with (
        _configured_teapot(),
        mock.patch.object(settings, "SENTRY_TEAPOT_SHARED_SECRET", "", create=True),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.return_value = _FakeResponse(200, _completed_response())
        TeapotClient(_FakeProject(), "abc").symbolicate(_FakeAttachment())

    assert "Authorization" not in mock_post.call_args.kwargs["headers"]


@pytest.mark.parametrize(
    "filename,expected",
    [
        # Production SDKs ship the full 32-hex uid.
        ("59339c1ea893474000000210749de540.nvdbg", "59339c1ea893474000000210749de540"),
        # The NVIDIA D3D12HelloNsightAftermath sample splits id[0]/id[1] with a dash.
        ("shader-59339c1ea8934740-00000210749de540.nvdbg", "59339c1ea893474000000210749de540"),
        # Uppercase normalizes to the decoder's lowercase key.
        ("ABCDEF0123456789ABCDEF0123456789.nvdbg", "abcdef0123456789abcdef0123456789"),
        # No parseable uid (caller falls back to the raw filename).
        ("garbage.txt", None),
    ],
)
def test_uid_from_nvdbg_filename(filename: str, expected: str | None) -> None:
    assert _uid_from_nvdbg_filename(filename) == expected


@pytest.mark.parametrize(
    "first_attempt",
    [_FakeResponse(503), requests.ConnectionError("boom")],
    ids=["retryable_5xx", "network_error"],
)
def test_client_retries_then_succeeds(first_attempt: Any) -> None:
    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.side_effect = [first_attempt, _FakeResponse(200, _completed_response())]
        result = TeapotClient(_FakeProject(), "abc").symbolicate(_FakeAttachment())

    assert result["status"] == "completed"
    assert mock_post.call_count == 2


def test_client_exhausts_retries() -> None:
    project = _FakeProject()
    dump = _FakeAttachment(b"dump")

    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.return_value = _FakeResponse(503)

        with pytest.raises(TeapotUnavailable):
            TeapotClient(project, "abc").symbolicate(dump)

    assert mock_post.call_count == 2


def test_client_400_is_not_retried() -> None:
    project = _FakeProject()
    dump = _FakeAttachment(b"dump")

    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.return_value = _FakeResponse(400, "bad request")

        # A 4xx is a client error, not an outage.
        with pytest.raises(TeapotRequestError):
            TeapotClient(project, "abc").symbolicate(dump)

    assert mock_post.call_count == 1


def test_client_non_json_body() -> None:
    project = _FakeProject()
    dump = _FakeAttachment(b"dump")

    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.return_value = _FakeResponse(200, "not-json", raise_on_json=True)

        with pytest.raises(TeapotUnavailable):
            TeapotClient(project, "abc").symbolicate(dump)


def test_client_missing_url_raises() -> None:
    from django.conf import settings

    with mock.patch.object(settings, "SENTRY_TEAPOT_URL", None, create=True):
        with pytest.raises(TeapotRequestError):
            TeapotClient(_FakeProject(), "abc")


def test_client_skips_when_attachment_not_stored() -> None:
    project = _FakeProject()
    dump = _FakeAttachment(stored_id=None)

    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        with pytest.raises(TeapotRequestError):
            TeapotClient(project, "abc").symbolicate(dump)
        # A missing attachment is a data error, so submit_to_teapot skips (None),
        # never contacting teapot.
        assert submit_to_teapot(project, "abc", dump, []) is None

    assert mock_post.call_count == 0


def test_submit_to_teapot_returns_none_on_request_error() -> None:
    # A request/data error (here: URL not configured) is not an outage: skip
    # (None) so the caller doesn't trip the breaker.
    from django.conf import settings

    with mock.patch.object(settings, "SENTRY_TEAPOT_URL", None, create=True):
        assert submit_to_teapot(_FakeProject(), "abc", _FakeAttachment(b"dump"), []) is None


def test_submit_to_teapot_raises_on_outage() -> None:
    # A genuine outage (exhausted 5xx) propagates so the caller trips the breaker.
    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.requests.post", return_value=_FakeResponse(503)),
    ):
        with pytest.raises(TeapotUnavailable):
            submit_to_teapot(_FakeProject(), "abc", _FakeAttachment(b"dump"), [])


def test_submit_to_teapot_swallows_unexpected() -> None:
    project = _FakeProject()
    dump = _FakeAttachment(b"dump")
    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.TeapotClient") as mock_client,
        mock.patch("sentry.lang.native.teapot.sentry_sdk.capture_exception") as cap,
    ):
        mock_client.return_value.symbolicate.side_effect = RuntimeError("unexpected")
        assert submit_to_teapot(project, "abc", dump, []) is None
        cap.assert_called_once()
