"""Unit tests for the second (shader DIF) teapot round."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from unittest import mock

import orjson
import pytest
from django.conf import settings
from django.utils import timezone

from sentry.lang.native.shader_difs import (
    ShaderDifs,
    debug_id_from_debug_name,
    missing_shader_difs,
    resolve_shader_difs,
)
from sentry.lang.native.teapot import TeapotClient, TeapotRequestError, TeapotUnavailable
from sentry.models.debugfile import ProjectDebugFile
from sentry.models.project import Project
from sentry.tasks.gpu_crash import _try_symbolicate
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all

DXC_HASH = "731322bf682bdc554eefdd89098b7383"
DEBUG_ID = "731322bf-682b-dc55-4eef-dd89098b7383"
DEBUG_NAME = f"{DXC_HASH}.pdb"
AFTERMATH_HASH = "0123456789abcdef"
SHADER_GROUP = "GlobalShaders"

FIND_DUMP = "sentry.tasks.gpu_crash.find_gpu_crash_dump_attachment"
FIND_SHADERS = "sentry.tasks.gpu_crash.find_all_shader_debug_attachments"
SUBMIT_TEAPOT = "sentry.tasks.gpu_crash.submit_to_teapot"
APPLY = "sentry.tasks.gpu_crash.apply_gpu_crash_symbolication"
RESOLVE = "sentry.tasks.gpu_crash.resolve_shader_difs"


class _FakeProject:
    def __init__(self, id: int = 42, organization_id: int = 7) -> None:
        self.id = id
        self.organization_id = organization_id


class _FakeAttachment:
    def __init__(
        self,
        name: str = "dump.nv-gpudmp",
        stored_id: str | None = "dump-obj-id",
        data: bytes = b"dump",
    ) -> None:
        self.name = name
        self.stored_id = stored_id
        self.content_type = "application/octet-stream"
        self._data = data

    def load_data(self, project: Any = None) -> bytes:
        return self._data


class _FakeResponse:
    def __init__(self, status_code: int, body: Any = None) -> None:
        self.status_code = status_code
        self._body = body if body is not None else {}
        self.text = ""

    def json(self) -> Any:
        return self._body


def _partial(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "status": "partial",
        "fault_category": "shader_hang",
        "missing_difs": [
            {"debug_id": AFTERMATH_HASH, "kind": "dxil"},
            {"debug_id": DEBUG_NAME, "kind": "dxil_pdb"},
        ],
    }
    base.update(overrides)
    return base


def _completed() -> dict[str, Any]:
    return {"status": "completed", "fault_category": "shader_hang", "missing_difs": []}


def _resolved() -> ShaderDifs:
    return ShaderDifs(
        binaries=[
            {
                "code_id": AFTERMATH_HASH,
                "storage_url": "http://objectstore/dxil?sig=x",
                "group": SHADER_GROUP,
            }
        ],
        pdbs=[{"debug_name": DEBUG_NAME, "storage_url": "http://objectstore/pdb?sig=x"}],
    )


@pytest.fixture
def teapot_session() -> Iterator[mock.Mock]:
    session = mock.Mock()
    session.put.return_value = "inline-key"
    get_url = mock.Mock(side_effect=lambda _session, key: f"http://objectstore/{key}?sig=abc")
    with (
        mock.patch.object(settings, "SENTRY_TEAPOT_URL", "http://teapot.test", create=True),
        mock.patch("sentry.lang.native.teapot.get_session", return_value=session),
        mock.patch("sentry.lang.native.teapot.get_internal_download_url", get_url),
    ):
        yield session


# ---------------------------------------------------------------------------
# TeapotClient — second round wire format
# ---------------------------------------------------------------------------


def test_client_second_round_sends_shader_arrays(teapot_session: mock.Mock) -> None:
    resolved = _resolved()
    with mock.patch("sentry.lang.native.teapot.requests.post") as mock_post:
        mock_post.return_value = _FakeResponse(200, _completed())
        TeapotClient(_FakeProject(), "abc").symbolicate(
            _FakeAttachment(),
            [],
            shader_binaries=resolved.binaries,
            shader_pdbs=resolved.pdbs,
        )

    kwargs = mock_post.call_args.kwargs
    assert kwargs["headers"]["Idempotency-Key"] == "abc-2"
    assert kwargs["headers"]["X-Request-Id"] == "abc-2"

    body = orjson.loads(kwargs["data"])
    assert body["event_id"] == "abc"
    assert body["dump"] == {"storage_url": "http://objectstore/dump-obj-id?sig=abc"}
    assert body["shader_binaries"] == resolved.binaries
    assert body["shader_pdbs"] == resolved.pdbs


def test_client_first_round_omits_shader_arrays(teapot_session: mock.Mock) -> None:
    with mock.patch("sentry.lang.native.teapot.requests.post") as mock_post:
        mock_post.return_value = _FakeResponse(200, _completed())
        TeapotClient(_FakeProject(), "abc").symbolicate(_FakeAttachment(), [])

    kwargs = mock_post.call_args.kwargs
    assert kwargs["headers"]["Idempotency-Key"] == "abc"
    assert kwargs["headers"]["X-Request-Id"] == "abc"
    body = orjson.loads(kwargs["data"])
    assert "shader_binaries" not in body
    assert "shader_pdbs" not in body


def test_client_inline_fallback_uploads_uncached_attachment(teapot_session: mock.Mock) -> None:
    dump = _FakeAttachment(stored_id=None, data=b"gpu-dump-bytes")
    with (
        mock.patch.object(settings, "SENTRY_TEAPOT_INLINE_ATTACHMENT_FALLBACK", True, create=True),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        mock_post.return_value = _FakeResponse(200, _completed())
        TeapotClient(_FakeProject(), "abc").symbolicate(dump, [])

    teapot_session.put.assert_called_once()
    assert teapot_session.put.call_args.args[0] == b"gpu-dump-bytes"
    assert teapot_session.put.call_args.kwargs["filename"] == "dump.nv-gpudmp"
    assert dump.stored_id == "inline-key"
    body = orjson.loads(mock_post.call_args.kwargs["data"])
    assert body["dump"] == {"storage_url": "http://objectstore/inline-key?sig=abc"}


def test_client_inline_fallback_off_by_default(teapot_session: mock.Mock) -> None:
    with (
        mock.patch.object(settings, "SENTRY_TEAPOT_INLINE_ATTACHMENT_FALLBACK", False, create=True),
        mock.patch("sentry.lang.native.teapot.requests.post") as mock_post,
    ):
        with pytest.raises(TeapotRequestError):
            TeapotClient(_FakeProject(), "abc").symbolicate(_FakeAttachment(stored_id=None), [])

    teapot_session.put.assert_not_called()
    assert mock_post.call_count == 0


# ---------------------------------------------------------------------------
# shader_difs — resolving missing_difs against ProjectDebugFile
# ---------------------------------------------------------------------------


def test_missing_shader_difs_parsing() -> None:
    response = _partial(
        missing_difs=[
            {"debug_id": AFTERMATH_HASH, "kind": "dxil"},
            {"debug_id": DEBUG_NAME, "kind": "dxil_pdb"},
            {"debug_id": "deadbeef", "kind": "pdb"},
            {"kind": "dxil"},
            "garbage",
        ]
    )
    assert missing_shader_difs(response) == ([AFTERMATH_HASH], [DEBUG_NAME])
    assert missing_shader_difs({}) == ([], [])


@pytest.mark.parametrize(
    "debug_name,expected",
    (
        (DEBUG_NAME, DEBUG_ID),
        (DXC_HASH.upper() + ".PDB", DEBUG_ID),
        ("C:\\build\\shaders\\" + DEBUG_NAME, DEBUG_ID),
        (DXC_HASH, DEBUG_ID),
        ("not-a-hash.pdb", None),
    ),
)
def test_debug_id_from_debug_name(debug_name: str, expected: str | None) -> None:
    assert debug_id_from_debug_name(debug_name) == expected


def _create_dif(
    project: Project,
    dif_type: str,
    code_id: str | None = None,
    storage_path: str | None = "difs/shader",
    shader_group: str | None = None,
) -> ProjectDebugFile:
    content_type = "application/x-dxil" if dif_type == "dxil" else "application/x-dxil-pdb"
    features = ["symtab"] if dif_type == "dxil" else ["debug"]
    data: dict[str, Any] = {"type": dif_type, "features": features}
    if shader_group is not None:
        data["shader_group"] = shader_group
    return ProjectDebugFile.objects.create(
        project_id=project.id,
        debug_id=DEBUG_ID,
        code_id=code_id,
        object_name="shader",
        cpu_name="any",
        checksum="0" * 40,
        data=data,
        storage_path=storage_path,
        content_type=content_type,
        file_size=64,
        date_created=timezone.now(),
    )


@pytest.fixture
def dif_presign() -> Iterator[mock.Mock]:
    get_url = mock.Mock(
        side_effect=lambda _session, key, token_validity=None: f"http://objectstore/{key}?sig=x"
    )
    with (
        mock.patch.object(ProjectDebugFile, "get_objectstore_session", return_value=mock.Mock()),
        mock.patch("sentry.lang.native.shader_difs.get_internal_download_url", get_url),
    ):
        yield get_url


@django_db_all
def test_resolve_shader_difs_presigns_objectstore_rows(
    default_project: Project, dif_presign: mock.Mock
) -> None:
    _create_dif(
        default_project,
        "dxil",
        code_id=AFTERMATH_HASH,
        storage_path="difs/dxil",
        shader_group=SHADER_GROUP,
    )
    _create_dif(default_project, "dxilpdb", storage_path="difs/pdb")

    resolved = resolve_shader_difs(default_project, _partial())

    assert bool(resolved) is True
    assert resolved.binaries == [
        {
            "code_id": AFTERMATH_HASH,
            "storage_url": "http://objectstore/difs/dxil?sig=x",
            "group": SHADER_GROUP,
        }
    ]
    assert resolved.pdbs == [
        {"debug_name": DEBUG_NAME, "storage_url": "http://objectstore/difs/pdb?sig=x"}
    ]
    # Token validity is the longer DIF one, not the attachment default.
    assert dif_presign.call_args.kwargs["token_validity"] is not None


@django_db_all
def test_resolve_shader_difs_matches_code_id_case_insensitively(
    default_project: Project, dif_presign: mock.Mock
) -> None:
    _create_dif(default_project, "dxil", code_id=AFTERMATH_HASH)
    response = _partial(missing_difs=[{"debug_id": AFTERMATH_HASH.upper(), "kind": "dxil"}])

    resolved = resolve_shader_difs(default_project, response)

    assert resolved.binaries == [
        {"code_id": AFTERMATH_HASH, "storage_url": "http://objectstore/difs/shader?sig=x"}
    ]
    assert resolved.pdbs == []


@django_db_all
def test_resolve_shader_difs_ignores_other_types(
    default_project: Project, dif_presign: mock.Mock
) -> None:
    # Same debug_id, but the row is the binary; teapot asked for the PDB.
    _create_dif(default_project, "dxil", code_id=AFTERMATH_HASH)
    response = _partial(missing_difs=[{"debug_id": DEBUG_NAME, "kind": "dxil_pdb"}])

    resolved = resolve_shader_difs(default_project, response)

    assert bool(resolved) is False


@django_db_all
def test_resolve_shader_difs_skips_legacy_rows(
    default_project: Project, dif_presign: mock.Mock
) -> None:
    _create_dif(default_project, "dxil", code_id=AFTERMATH_HASH, storage_path=None)
    _create_dif(default_project, "dxilpdb", storage_path=None)

    resolved = resolve_shader_difs(default_project, _partial())

    assert bool(resolved) is False
    dif_presign.assert_not_called()


@django_db_all
def test_resolve_shader_difs_nothing_missing(default_project: Project) -> None:
    assert bool(resolve_shader_difs(default_project, _completed())) is False


# ---------------------------------------------------------------------------
# Task — second round orchestration
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def circuit_breaker() -> Iterator[mock.Mock]:
    breaker = mock.Mock()
    breaker.should_allow_request.return_value = True
    with mock.patch("sentry.tasks.gpu_crash._teapot_circuit_breaker", return_value=breaker):
        yield breaker


@django_db_all
def test_task_runs_second_round_with_resolved_difs(
    default_project: Project, circuit_breaker: mock.Mock
) -> None:
    data: dict[str, Any] = {"event_id": "e", "project": default_project.id}
    partial, completed = _partial(), _completed()
    with (
        override_options({"teapot.enabled": True}),
        mock.patch(FIND_DUMP, return_value=_FakeAttachment()),
        mock.patch(FIND_SHADERS, return_value=[]),
        mock.patch(RESOLVE, return_value=_resolved()) as resolve,
        mock.patch(SUBMIT_TEAPOT, side_effect=[partial, completed]) as teapot,
        mock.patch(APPLY, return_value=data) as apply,
    ):
        changed = _try_symbolicate(data, default_project.id, "e")

    assert changed is True
    assert resolve.call_args.args[1] is partial
    assert teapot.call_count == 2
    second = teapot.call_args_list[1]
    assert second.kwargs["shader_binaries"] == _resolved().binaries
    assert second.kwargs["shader_pdbs"] == _resolved().pdbs
    assert apply.call_args.args[1] is completed
    circuit_breaker.record_success.assert_called_once()
    circuit_breaker.record_error.assert_not_called()


@django_db_all
def test_task_keeps_first_response_when_nothing_resolved(default_project: Project) -> None:
    data: dict[str, Any] = {"event_id": "e", "project": default_project.id}
    partial = _partial()
    with (
        override_options({"teapot.enabled": True}),
        mock.patch(FIND_DUMP, return_value=_FakeAttachment()),
        mock.patch(FIND_SHADERS, return_value=[]),
        mock.patch(RESOLVE, return_value=ShaderDifs()),
        mock.patch(SUBMIT_TEAPOT, return_value=partial) as teapot,
        mock.patch(APPLY, return_value=data) as apply,
    ):
        _try_symbolicate(data, default_project.id, "e")

    assert teapot.call_count == 1
    assert apply.call_args.args[1] is partial


@django_db_all
def test_task_skips_second_round_when_completed(default_project: Project) -> None:
    data: dict[str, Any] = {"event_id": "e", "project": default_project.id}
    with (
        override_options({"teapot.enabled": True}),
        mock.patch(FIND_DUMP, return_value=_FakeAttachment()),
        mock.patch(FIND_SHADERS, return_value=[]),
        mock.patch(RESOLVE) as resolve,
        mock.patch(SUBMIT_TEAPOT, return_value=_completed()) as teapot,
        mock.patch(APPLY, return_value=data),
    ):
        _try_symbolicate(data, default_project.id, "e")

    assert teapot.call_count == 1
    resolve.assert_not_called()


@pytest.mark.parametrize("second_outcome", (TeapotUnavailable("down"), None, RuntimeError("x")))
@django_db_all
def test_task_second_round_failure_falls_back_to_first_response(
    default_project: Project, circuit_breaker: mock.Mock, second_outcome: Any
) -> None:
    data: dict[str, Any] = {"event_id": "e", "project": default_project.id}
    partial = _partial()
    with (
        override_options({"teapot.enabled": True}),
        mock.patch(FIND_DUMP, return_value=_FakeAttachment()),
        mock.patch(FIND_SHADERS, return_value=[]),
        mock.patch(RESOLVE, return_value=_resolved()),
        mock.patch(SUBMIT_TEAPOT, side_effect=[partial, second_outcome]) as teapot,
        mock.patch(APPLY, return_value=data) as apply,
        mock.patch("sentry.tasks.gpu_crash.sentry_sdk.capture_exception"),
    ):
        changed = _try_symbolicate(data, default_project.id, "e")

    assert changed is True
    assert teapot.call_count == 2
    assert apply.call_args.args[1] is partial
    circuit_breaker.record_success.assert_called_once()
    circuit_breaker.record_error.assert_not_called()


@django_db_all
def test_task_resolver_error_falls_back_to_first_response(default_project: Project) -> None:
    data: dict[str, Any] = {"event_id": "e", "project": default_project.id}
    partial = _partial()
    with (
        override_options({"teapot.enabled": True}),
        mock.patch(FIND_DUMP, return_value=_FakeAttachment()),
        mock.patch(FIND_SHADERS, return_value=[]),
        mock.patch(RESOLVE, side_effect=RuntimeError("db down")),
        mock.patch(SUBMIT_TEAPOT, return_value=partial) as teapot,
        mock.patch(APPLY, return_value=data) as apply,
        mock.patch("sentry.tasks.gpu_crash.sentry_sdk.capture_exception"),
    ):
        changed = _try_symbolicate(data, default_project.id, "e")

    assert changed is True
    assert teapot.call_count == 1
    assert apply.call_args.args[1] is partial
