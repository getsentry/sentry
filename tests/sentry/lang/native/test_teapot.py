"""
Unit tests for the teapot client + GPU event enrichment.

Covers:
* `TeapotClient.symbolicate` — both multipart and JSON+storage_url paths
* `submit_to_teapot` wrapper — best-effort error swallowing
* `apply_gpu_crash_symbolication` — applying teapot's decode to the event
* `_normalize_gpu_frames` — frame normalization edge cases
"""

from __future__ import annotations

import contextlib
from collections.abc import Iterator
from typing import Any
from unittest import mock

import pytest
import requests

from sentry.lang.native.gpu import (
    GPU_CRASH_DUMP_ATTACHMENT_TYPE,
    _build_flat_gpu_context,
    _normalize_gpu_frames,
    apply_gpu_crash_symbolication,
)
from sentry.lang.native.teapot import (
    TeapotClient,
    TeapotUnavailable,
    _uid_from_nvdbg_filename,
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
    """Context manager: sets SENTRY_TEAPOT_URL so the client resolves an endpoint."""

    from django.conf import settings

    with mock.patch.object(settings, "SENTRY_TEAPOT_URL", url, create=True):
        yield


@pytest.fixture(autouse=True)
def _skip_retry_backoff() -> Iterator[None]:
    """Skip teapot's inter-retry backoff sleep so retry tests stay instant."""
    with mock.patch("sentry.lang.native.teapot.time.sleep"):
        yield


# ---------------------------------------------------------------------------
# apply_gpu_crash_symbolication
# ---------------------------------------------------------------------------


def _relay_gpu_event() -> dict[str, Any]:
    """The in-flight GPU event as Relay hands it to us: identity, trace, release
    and the `cpu_event_id` link already set; the `.nv-gpudmp` decode not yet
    applied."""
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


def test_apply_fingerprint_fallback() -> None:
    """A response without a fingerprint still groups deterministically."""
    data = _relay_gpu_event()
    apply_gpu_crash_symbolication(
        data, _completed_response(fingerprint=[], fault_category="page_fault")
    )
    assert data["fingerprint"] == ["gpu", "page_fault"]


@pytest.mark.parametrize(
    "response",
    [
        # active_shaders is a truthy non-list — the reported case (dict / str / int).
        _completed_response(shader_context={"active_shaders": {"shader_hash": "x"}}),
        _completed_response(shader_context={"active_shaders": "nope"}),
        _completed_response(shader_context={"active_shaders": 7}),
        # shader_context / fault / gpu_state themselves are non-dicts, and the
        # list fields (missing_difs / fingerprint / warnings) are truthy scalars
        # — len()/list() over them must not raise.
        _completed_response(
            shader_context="nope", fault="nope", gpu_state=7, missing_difs=5, fingerprint=9
        ),
        _completed_response(
            shader_context=[], fault=None, gpu_state=[], missing_difs="x", warnings="w"
        ),
    ],
)
def test_apply_survives_malformed_teapot_response(response: dict[str, Any]) -> None:
    # teapot output is unvalidated external JSON: a truthy non-list/non-dict must
    # never reach active_shaders[0] / primary_shader.get(...) / len() / list(). It
    # should just drop the offending fields, not raise.
    ctx = _build_flat_gpu_context(response)
    data = _relay_gpu_event()
    out = apply_gpu_crash_symbolication(data, response)

    assert out is data
    assert "shader_hash" not in ctx
    assert "gpu.shader_hash" not in dict(data["tags"])
    # len()/list() over the scalar list fields yielded empties, not a TypeError.
    assert ctx["missing_dif_count"] == 0
    assert isinstance(data["fingerprint"], list)


def test_apply_skips_failed_status() -> None:
    data = _relay_gpu_event()
    out = apply_gpu_crash_symbolication(data, {"status": "failed"})

    assert out is None
    # The event is left untouched — it still saves, just unenriched.
    assert "exception" not in data
    assert "fingerprint" not in data


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
    # event_id doubles as the idempotency key so a retried task replays
    # teapot's cached decode instead of re-running it.
    assert kwargs["headers"]["Idempotency-Key"] == "abc"


def test_client_multipart_carries_shader_debug_attachments() -> None:
    """Each .nvdbg becomes its own `nv_shader_debug.<uid>` field, the uid derived
    from the attachment filename."""

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
        TeapotClient(project, "abc").symbolicate(dump, [nvdbg1, nvdbg2])

    files = mock_post.call_args.kwargs["files"]
    # `files` is a list-of-tuples (the only way to repeat field names); teapot
    # keys each shader by the uid in the `nv_shader_debug.<uid>` field name.
    by_field = {field_name: payload for field_name, payload in files}
    assert "upload_file" in by_field
    assert by_field[f"nv_shader_debug.{'a' * 32}"][1] == b"nvdbg-bytes-1"
    assert by_field[f"nv_shader_debug.{'b' * 32}"][1] == b"nvdbg-bytes-2"


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

    # Default teapot.max-attempts is 2 (kept low so a slow teapot can't pile up
    # work on the GPU task worker).
    assert mock_post.call_count == 2


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
        mock.patch.object(settings, "SENTRY_TEAPOT_URL", None, create=True),
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
        mock.patch.object(settings, "SENTRY_TEAPOT_URL", None, create=True),
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

        TeapotClient(project, "abc").symbolicate(dump, [nvdbg])

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
    assert body["shader_debug_info"][0]["uid"] == "cafebabecafebabecafebabecafebabe"
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
        TeapotClient(project, "abc").symbolicate(dump, [nvdbg])

    # Objectstore session is never opened because the mixed-state check
    # routes to multipart immediately.
    assert mock_session_fn.call_count == 0
    # Multipart: `files` populated with inline bytes.
    files = mock_post.call_args.kwargs["files"]
    by_field = {field_name: payload for field_name, payload in files}
    assert by_field["upload_file"][1] == b"dump-bytes"
    assert by_field[f"nv_shader_debug.{'cafebabe' * 4}"][1] == b"nvdbg-bytes"


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
        mock.patch.object(settings, "SENTRY_TEAPOT_URL", None, create=True),
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


def test_normalize_gpu_frames_tolerates_non_mapping_data() -> None:
    """teapot's `frames[].data` is external and may not be a dict.

    A truthy non-dict (string/list) must not crash `dict(...)` or the
    `shader_hash` lookup — the frame is still normalized, just without `data`.
    """

    frames = [
        {"function": "vertex", "data": "not-a-dict"},
        {"function": "pixel", "data": [1, 2, 3]},
        {"function": "compute", "data": {"shader_hash": 12345}},  # non-str hash
        {"function": "ok", "data": {"shader_hash": "abc123"}},
    ]

    result = _normalize_gpu_frames(frames)

    assert [f["function"] for f in result] == ["vertex", "pixel", "compute", "ok"]
    # Non-dict data is dropped (no crash); no synthetic package is derived.
    assert "package" not in result[0]
    assert "package" not in result[1]
    # Non-str shader_hash is ignored rather than crashing `.startswith`.
    assert "package" not in result[2]
    # A well-formed str shader_hash still produces a package.
    assert result[3]["package"] == "shader_abc123"
