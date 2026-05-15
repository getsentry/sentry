"""
Unit tests for teapot integration.

Covers:
* `_merge_gpu_response` — flatten + raw context shaping
* `TeapotClient.symbolicate` — both multipart and JSON+storage_url paths
* `submit_to_teapot` wrapper — best-effort error swallowing
* `process_gpu_crash_dump` — top-level orchestration
* `_produce_gpu_occurrence` — issue creation with teapot-supplied fingerprint
"""

from __future__ import annotations

import contextlib
from collections.abc import Iterator
from typing import Any
from unittest import mock

import pytest
import requests

from sentry.lang.native.gpu import _produce_gpu_occurrence
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


class _FakeProject:
    def __init__(self, id: int = 42, organization_id: int = 7) -> None:
        self.id = id
        self.organization_id = organization_id


class _FakeAttachment:
    """Stand-in for `sentry.attachments.CachedAttachment` in unit tests.

    Carries enough surface for the teapot client: bytes via `load_data`,
    the attachment `type`, the filename `name`, and an optional
    `stored_id`. When `stored_id` is set teapot's client routes via the
    JSON+storage_url path; otherwise it falls back to multipart.
    """

    def __init__(
        self,
        data: bytes,
        attachment_type: str = GPU_CRASH_DUMP_ATTACHMENT_TYPE,
        name: str = "dump.nv-gpudmp",
        stored_id: str | None = None,
    ) -> None:
        self._data = data
        self.type = attachment_type
        self.name = name
        self.stored_id = stored_id

    def load_data(self, _project: Any) -> bytes:
        return self._data


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
    """Context manager: sets TEAPOT_URL so the client resolves an endpoint."""

    from django.conf import settings

    with mock.patch.object(settings, "TEAPOT_URL", url, create=True):
        yield


# ---------------------------------------------------------------------------
# _merge_gpu_response
# ---------------------------------------------------------------------------


def test_merge_gpu_response_writes_context() -> None:
    data: dict[str, Any] = {}
    response = _completed_response(
        fault={"type": "PageFault", "code": "FOO", "virtual_address": "0xdeadbeef"},
        gpu_state={"device_name": "Test GPU"},
        shader_context={
            "active_shaders": [{"shader_hash": "abc123", "shader_type": "Vertex"}],
        },
        frames=[{"function": "main", "module": "abc123"}],
    )

    _merge_gpu_response(data, response)

    ctx = data["contexts"]["gpu_crash"]
    assert ctx["status"] == "completed"
    assert ctx["handler"] == "aftermath"
    assert ctx["sdk_version"] == "2025.5.0"
    # New top-level teapot fields lifted onto the flat context.
    assert ctx["fault_category"] == "shader_hang"
    assert ctx["title"] == "GPU hang in vertex_02"
    # Flat shape: UI-friendly top-level scalars instead of nested blobs.
    assert ctx["fault_type"] == "PageFault"
    assert ctx["device_name"] == "Test GPU"
    assert ctx["shader_hash"] == "abc123"
    # Nested fault/gpu_state/shader_context do not appear on the flat context.
    assert "fault" not in ctx
    assert "gpu_state" not in ctx
    assert "shader_context" not in ctx
    assert ctx["missing_dif_count"] == 0

    # Raw nested blobs still available under gpu_crash_raw (hidden in UI).
    raw = data["contexts"]["gpu_crash_raw"]
    assert raw["type"] == "default"
    assert raw["fault"]["type"] == "PageFault"
    assert raw["gpu_state"]["device_name"] == "Test GPU"
    # Frames go to the private channel, not user-visible context.
    assert data["_gpu_crash_private"]["frames"] == [{"function": "main", "module": "abc123"}]


def test_merge_gpu_response_preserves_trace_id() -> None:
    trace_id = "aabbccddeeff00112233445566778899"
    data: dict[str, Any] = {
        "contexts": {"trace": {"trace_id": trace_id, "span_id": "0011223344556677"}},
    }
    response = _completed_response(status="partial")

    _merge_gpu_response(data, response)

    # The trace context is untouched. This is the whole point of keeping the
    # GPU merge additive.
    assert data["contexts"]["trace"]["trace_id"] == trace_id
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
    # No frames / raw context written when decode failed.
    assert "_gpu_crash_private" not in data


def test_merge_gpu_response_lifts_markers_privately() -> None:
    """Markers go to the private channel for the occurrence breadcrumbs path."""

    data: dict[str, Any] = {}
    response = _completed_response(
        markers=[
            {"kind": "user_defined", "label": "UserDefined+0", "data": "Engine state: Rendering"},
            {"kind": "aftermath", "label": "CommandQueue", "data": {}},
        ],
    )

    _merge_gpu_response(data, response)

    private = data["_gpu_crash_private"]
    assert len(private["markers"]) == 2
    assert private["markers"][0]["kind"] == "user_defined"


def test_merge_gpu_response_preserves_exception() -> None:
    """Primary CPU exception must not be touched by GPU merge."""

    cpu_exception = {
        "values": [{"type": "ACCESS_VIOLATION", "value": "CPU crash", "stacktrace": {"frames": []}}]
    }
    data: dict[str, Any] = {
        "exception": cpu_exception,
        "platform": "native",
    }

    _merge_gpu_response(data, _completed_response())

    assert data["exception"] is cpu_exception
    assert data["platform"] == "native"


# ---------------------------------------------------------------------------
# TeapotClient — multipart wire format
# ---------------------------------------------------------------------------


def test_client_multipart_success() -> None:
    project = _FakeProject()
    dump = _FakeAttachment(b"dummy-dump-bytes", stored_id=None)
    expected = _completed_response()

    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.return_value = _FakeResponse(200, expected)

        result = TeapotClient(project, "abc").symbolicate(dump)

    assert result == expected
    assert mock_post.call_count == 1
    args, kwargs = mock_post.call_args
    assert args[0] == "http://teapot.test/symbolicate"
    # Identifiers carried as multipart form fields, NOT as a `sources` JSON
    # — we no longer send a source-config block.
    assert kwargs["data"]["event_id"] == "abc"
    assert kwargs["data"]["project_id"] == "42"
    assert kwargs["data"]["organization_id"] == "7"
    assert "sources" not in kwargs["data"]
    # Dump arrives as the canonical `upload_file` multipart field.
    files = dict(kwargs["files"])
    assert files["upload_file"][1] == b"dummy-dump-bytes"
    assert kwargs["headers"]["X-Teapot-Version"] == "1"
    assert kwargs["headers"]["X-Request-Id"] == "abc"


def test_client_multipart_carries_shader_debug_attachments() -> None:
    """Each .nvdbg attachment becomes its own `nv_shader_debug.<uid>` field."""

    project = _FakeProject()
    dump = _FakeAttachment(b"dump-bytes")
    nvdbg1 = _FakeAttachment(
        b"nvdbg-bytes-1",
        attachment_type="event.nv_shader_debug",
        name="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.nvdbg",
    )
    nvdbg2 = _FakeAttachment(
        b"nvdbg-bytes-2",
        attachment_type="event.nv_shader_debug",
        name="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.nvdbg",
    )

    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.return_value = _FakeResponse(200, _completed_response())
        TeapotClient(project, "abc").symbolicate(
            dump,
            [
                ("a" * 32, nvdbg1),
                ("b" * 32, nvdbg2),
            ],
        )

    files = mock_post.call_args.kwargs["files"]
    # `files` is a list-of-tuples (the only way to repeat field names),
    # so map by the first element for ergonomic assertions.
    by_field = {field_name: payload for field_name, payload in files}
    assert "upload_file" in by_field
    assert by_field[f"nv_shader_debug.{'a' * 32}"][1] == b"nvdbg-bytes-1"
    assert by_field[f"nv_shader_debug.{'b' * 32}"][1] == b"nvdbg-bytes-2"


def test_client_retries_on_503() -> None:
    project = _FakeProject()
    dump = _FakeAttachment(b"dump")

    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.side_effect = [
            _FakeResponse(503),
            _FakeResponse(200, _completed_response(status="partial")),
        ]

        result = TeapotClient(project, "abc").symbolicate(dump)

    assert result["status"] == "partial"
    assert mock_post.call_count == 2


def test_client_retries_on_network_error() -> None:
    project = _FakeProject()
    dump = _FakeAttachment(b"dump")

    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.side_effect = [
            requests.ConnectionError("boom"),
            _FakeResponse(200, _completed_response()),
        ]

        result = TeapotClient(project, "abc").symbolicate(dump)

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

    assert mock_post.call_count == 3


def test_client_400_is_not_retried() -> None:
    project = _FakeProject()
    dump = _FakeAttachment(b"dump")

    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.return_value = _FakeResponse(400, "bad request")

        with pytest.raises(TeapotUnavailable):
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
    dump = _FakeAttachment(b"dump")
    with (
        mock.patch.object(settings, "TEAPOT_URL", None, create=True),
        mock.patch(
            "sentry.lang.native.teapot.options.get",
            lambda key: (
                {"url": "http://teapot-from-options.test"} if key == "teapot.options" else None
            ),
        ),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.return_value = _FakeResponse(200, _completed_response())
        TeapotClient(project, "abc").symbolicate(dump)

    assert mock_post.call_args[0][0] == "http://teapot-from-options.test/symbolicate"


# ---------------------------------------------------------------------------
# TeapotClient — JSON + storage_url + storage_token (objectstore path)
# ---------------------------------------------------------------------------


def test_client_uses_json_path_when_all_attachments_stored() -> None:
    """When every attachment has `stored_id`, pass URLs not bytes.

    Mirrors `Symbolicator.process_minidump`'s objectstore path. Teapot
    fetches the bytes directly from objectstore using the minted tokens.
    Bytes never pass through the Sentry worker.
    """

    project = _FakeProject()
    dump = _FakeAttachment(b"dump-bytes-should-not-be-sent", stored_id="dump-obj-id")
    nvdbg = _FakeAttachment(
        b"nvdbg-bytes-should-not-be-sent",
        attachment_type="event.nv_shader_debug",
        name="cafebabecafebabecafebabecafebabe.nvdbg",
        stored_id="nvdbg-obj-id",
    )

    fake_session = mock.Mock()
    fake_session.mint_token.side_effect = ["token-dump", "token-nvdbg"]

    with (
        _configured_teapot(),
        mock.patch(
            "sentry.lang.native.teapot.get_attachments_session",
            return_value=fake_session,
        ),
        mock.patch(
            "sentry.lang.native.teapot.get_symbolicator_url",
            side_effect=lambda _sess, key: f"http://objectstore/{key}",
        ),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.return_value = _FakeResponse(200, _completed_response())

        TeapotClient(project, "abc").symbolicate(dump, [("c" * 32, nvdbg)])

    # JSON path: `files` empty, Content-Type set, body is JSON-encoded.
    kwargs = mock_post.call_args.kwargs
    assert kwargs.get("files") is None
    assert kwargs["headers"]["Content-Type"] == "application/json"
    import orjson

    body = orjson.loads(kwargs["data"])
    assert body["event_id"] == "abc"
    assert body["dump"]["storage_url"] == "http://objectstore/dump-obj-id"
    assert body["dump"]["storage_token"] == "token-dump"
    assert len(body["shader_debug_info"]) == 1
    assert body["shader_debug_info"][0]["uid"] == "c" * 32
    assert body["shader_debug_info"][0]["storage_url"] == "http://objectstore/nvdbg-obj-id"
    assert body["shader_debug_info"][0]["storage_token"] == "token-nvdbg"


def test_client_falls_back_to_multipart_when_any_attachment_lacks_stored_id() -> None:
    """Mixed-state attachments → multipart (we can't combine wire formats)."""

    project = _FakeProject()
    dump = _FakeAttachment(b"dump-bytes", stored_id="dump-obj-id")
    # Second attachment has NO stored_id — forces multipart path.
    nvdbg = _FakeAttachment(
        b"nvdbg-bytes",
        attachment_type="event.nv_shader_debug",
        name="cafebabecafebabecafebabecafebabe.nvdbg",
        stored_id=None,
    )

    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
        mock.patch("sentry.lang.native.teapot.get_attachments_session") as mock_session_fn,
    ):
        mock_post.return_value = _FakeResponse(200, _completed_response())
        TeapotClient(project, "abc").symbolicate(dump, [("c" * 32, nvdbg)])

    # Objectstore session is never opened because the mixed-state check
    # routes to multipart immediately.
    assert mock_session_fn.call_count == 0
    # Multipart: `files` populated with inline bytes.
    files = mock_post.call_args.kwargs["files"]
    by_field = {field_name: payload for field_name, payload in files}
    assert by_field["upload_file"][1] == b"dump-bytes"
    assert by_field[f"nv_shader_debug.{'c' * 32}"][1] == b"nvdbg-bytes"


# ---------------------------------------------------------------------------
# submit_to_teapot (best-effort wrapper)
# ---------------------------------------------------------------------------


def test_submit_to_teapot_success() -> None:
    project = _FakeProject()
    dump = _FakeAttachment(b"dump")
    with (
        _configured_teapot(),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.return_value = _FakeResponse(200, _completed_response())
        result = submit_to_teapot(project, "abc", dump, [])
    assert result is not None
    assert result["status"] == "completed"


def test_submit_to_teapot_returns_none_when_unavailable() -> None:
    from django.conf import settings

    with (
        mock.patch.object(settings, "TEAPOT_URL", None, create=True),
        mock.patch(
            "sentry.lang.native.teapot.options.get",
            lambda key: None,
        ),
    ):
        assert submit_to_teapot(_FakeProject(), "abc", _FakeAttachment(b"dump"), []) is None


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


# ---------------------------------------------------------------------------
# process_gpu_crash_dump
# ---------------------------------------------------------------------------


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
    attachment = _FakeAttachment(b"dump")

    with (
        mock.patch(
            "sentry.lang.native.utils.find_gpu_crash_dump_attachment",
            return_value=attachment,
        ),
        mock.patch(
            "sentry.lang.native.utils.find_all_shader_debug_attachments",
            return_value=[],
        ),
        mock.patch(
            "sentry.lang.native.teapot.submit_to_teapot",
            return_value=None,
        ),
    ):
        result = process_gpu_crash_dump(data, project, "abc")

    assert result is data
    assert "contexts" not in data


def test_process_gpu_crash_dump_passes_shader_debug_to_client() -> None:
    """The orchestrator collects all .nvdbg attachments and hands them on."""

    data: dict[str, Any] = {"event_id": "ev-1"}
    project = _FakeProject()
    dump = _FakeAttachment(b"dump")
    nvdbg = _FakeAttachment(
        b"nvdbg",
        attachment_type="event.nv_shader_debug",
        name="d" * 32 + ".nvdbg",
    )

    with (
        mock.patch(
            "sentry.lang.native.utils.find_gpu_crash_dump_attachment",
            return_value=dump,
        ),
        mock.patch(
            "sentry.lang.native.utils.find_all_shader_debug_attachments",
            return_value=[("d" * 32, nvdbg)],
        ),
        mock.patch(
            "sentry.lang.native.teapot.submit_to_teapot",
            return_value=_completed_response(),
        ) as submit,
        mock.patch("sentry.issues.producer.produce_occurrence_to_kafka"),
        mock.patch(
            "sentry.lang.native.gpu._get_or_create_gpu_detector_id",
            return_value=None,
        ),
    ):
        process_gpu_crash_dump(data, project, "ev-1")

    # The shader_debug list reaches submit_to_teapot intact.
    args = submit.call_args.args
    assert args[2] is dump
    assert args[3] == [("d" * 32, nvdbg)]


def test_process_gpu_crash_dump_success_populates_context() -> None:
    data: dict[str, Any] = {
        "event_id": "ev-1",
        "contexts": {"trace": {"trace_id": "x" * 32}},
    }
    project = _FakeProject()
    attachment = _FakeAttachment(b"dump")
    response = _completed_response(
        status="partial",
        missing_difs=[{"debug_id": "x"}],
    )

    with (
        mock.patch(
            "sentry.lang.native.utils.find_gpu_crash_dump_attachment",
            return_value=attachment,
        ),
        mock.patch(
            "sentry.lang.native.utils.find_all_shader_debug_attachments",
            return_value=[],
        ),
        mock.patch(
            "sentry.lang.native.teapot.submit_to_teapot",
            return_value=response,
        ),
        mock.patch(
            "sentry.lang.native.gpu._get_or_create_gpu_detector_id",
            return_value=None,
        ),
        mock.patch("sentry.issues.producer.produce_occurrence_to_kafka"),
    ):
        result = process_gpu_crash_dump(data, project, "ev-1")

    assert result is data
    ctx = data["contexts"]["gpu_crash"]
    assert ctx["status"] == "partial"
    assert ctx["fault_category"] == "shader_hang"
    assert ctx["title"] == "GPU hang in vertex_02"
    # Trace preserved.
    assert data["contexts"]["trace"]["trace_id"] == "x" * 32
    assert data["_gpu_crash_private"]["frames"] == response["frames"]


# ---------------------------------------------------------------------------
# IssueOccurrence production
# ---------------------------------------------------------------------------


def test_occurrence_uses_teapot_fingerprint_and_title_verbatim() -> None:
    """Sentry no longer composes the fingerprint — teapot supplies it.

    This is the key change: teapot's `fingerprint` and `title` are
    authoritative. Whatever vector teapot puts in `response.fingerprint`
    becomes the IssueOccurrence's grouping key; `response.title` becomes
    the issue title. No Sentry-side rewriting.
    """

    data: dict[str, Any] = {"event_id": "ev-1"}
    project = _FakeProject()
    attachment = _FakeAttachment(b"dump")
    response = _completed_response(
        fault_category="page_fault",
        title="GPU page_fault: write on 'StreamingTextureAtlas'",
        fingerprint=["gpu", "page_fault", "write", "StreamingTextureAtlas"],
        # Non-shader crash: empty active_shaders so culprit falls
        # through to the category rather than a stale shader hash.
        shader_context={"active_shaders": []},
        # Synthetic frame: no shader at fault.
        frames=[
            {
                "function": "GPU page_fault: write on 'StreamingTextureAtlas'",
                "module": "Graphics",
                "data": {"synthetic": True, "fault_category": "page_fault"},
            }
        ],
    )

    with (
        mock.patch(
            "sentry.lang.native.utils.find_gpu_crash_dump_attachment",
            return_value=attachment,
        ),
        mock.patch(
            "sentry.lang.native.utils.find_all_shader_debug_attachments",
            return_value=[],
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
    occ = mock_produce.call_args.kwargs["occurrence"]
    assert occ.fingerprint == ["gpu", "page_fault", "write", "StreamingTextureAtlas"]
    assert occ.issue_title == "GPU page_fault: write on 'StreamingTextureAtlas'"
    assert occ.culprit == "page_fault"  # primary_shader is empty → category falls through


def test_occurrence_fingerprint_groups_consistently() -> None:
    """Same teapot fingerprint across events → same group."""

    project = _FakeProject()
    fingerprint = ["gpu", "shader_hang", "abc123"]
    response_a = _completed_response(fingerprint=fingerprint)
    response_b = _completed_response(fingerprint=fingerprint)
    response_c = _completed_response(fingerprint=["gpu", "shader_hang", "def456"])

    fingerprints: list[list[str]] = []

    def _capture(**kwargs: Any) -> None:
        fingerprints.append(list(kwargs["occurrence"].fingerprint))

    with (
        mock.patch(
            "sentry.lang.native.gpu._get_or_create_gpu_detector_id",
            return_value=None,
        ),
        mock.patch(
            "sentry.issues.producer.produce_occurrence_to_kafka",
            side_effect=_capture,
        ),
    ):
        _produce_gpu_occurrence({"event_id": "a"}, project, "a", response_a)
        _produce_gpu_occurrence({"event_id": "b"}, project, "b", response_b)
        _produce_gpu_occurrence({"event_id": "c"}, project, "c", response_c)

    assert fingerprints[0] == fingerprints[1]  # same fingerprint → grouped
    assert fingerprints[0] != fingerprints[2]  # different fingerprint → separate


def test_occurrence_carries_markers_as_breadcrumbs() -> None:
    """Markers become breadcrumbs on the GPU event."""

    data: dict[str, Any] = {"event_id": "ev-1"}
    project = _FakeProject()
    attachment = _FakeAttachment(b"dump")
    response = _completed_response(
        markers=[
            {"kind": "user_defined", "label": "UserDefined+0", "data": "Shadow pass"},
            {"kind": "aftermath", "label": "CommandQueue", "data": {"event": "draw"}},
        ],
    )

    with (
        mock.patch(
            "sentry.lang.native.utils.find_gpu_crash_dump_attachment",
            return_value=attachment,
        ),
        mock.patch(
            "sentry.lang.native.utils.find_all_shader_debug_attachments",
            return_value=[],
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

    event_payload = mock_produce.call_args.kwargs["event_data"]
    breadcrumbs = event_payload.get("breadcrumbs", {}).get("values") or []
    assert len(breadcrumbs) == 2
    assert breadcrumbs[0]["category"] == "gpu.user_defined"
    assert "Shadow pass" in breadcrumbs[0]["message"]


def test_occurrence_not_fired_on_failed_status() -> None:
    """`failed` status means teapot couldn't decode. No fingerprint → no issue."""

    data: dict[str, Any] = {"event_id": "ev-1"}
    project = _FakeProject()
    attachment = _FakeAttachment(b"dump")
    response = {"status": "failed", "error": {"code": "DUMP_CORRUPTED"}}

    with (
        mock.patch(
            "sentry.lang.native.utils.find_gpu_crash_dump_attachment",
            return_value=attachment,
        ),
        mock.patch(
            "sentry.lang.native.utils.find_all_shader_debug_attachments",
            return_value=[],
        ),
        mock.patch(
            "sentry.lang.native.teapot.submit_to_teapot",
            return_value=response,
        ),
        mock.patch("sentry.issues.producer.produce_occurrence_to_kafka") as mock_produce,
    ):
        process_gpu_crash_dump(data, project, "ev-1")

    assert data["contexts"]["gpu_crash"]["status"] == "failed"
    assert mock_produce.call_count == 0


def test_occurrence_producer_error_is_swallowed() -> None:
    """Issue platform errors must never fail the primary CPU event."""

    data: dict[str, Any] = {"event_id": "ev-1"}
    project = _FakeProject()
    attachment = _FakeAttachment(b"dump")

    with (
        mock.patch(
            "sentry.lang.native.utils.find_gpu_crash_dump_attachment",
            return_value=attachment,
        ),
        mock.patch(
            "sentry.lang.native.utils.find_all_shader_debug_attachments",
            return_value=[],
        ),
        mock.patch(
            "sentry.lang.native.teapot.submit_to_teapot",
            return_value=_completed_response(),
        ),
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
