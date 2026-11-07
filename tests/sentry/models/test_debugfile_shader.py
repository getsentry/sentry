from __future__ import annotations

import io
from pathlib import Path
from unittest import mock

import pytest

from sentry.api.endpoints.debug_files import batch_assemble
from sentry.constants import KNOWN_DIF_FORMATS
from sentry.models.debugfile import (
    DIF_MIMETYPES,
    SHADER_GROUP_MAX_LENGTH,
    BadDif,
    DifKind,
    ProjectDebugFile,
    _dif_file_extension,
    _get_dif_object_name,
    create_dif_from_fileobj,
    detect_dif_from_path,
    detect_single_dif_from_path,
    determine_dif_kind,
)
from sentry.models.project import Project
from sentry.tasks.assemble import AssembleTask, ChunkFileState, set_assemble_status
from sentry.testutils.pytest.fixtures import django_db_all

DXC_HASH = "731322bf682bdc554eefdd89098b7383"
DEBUG_ID = "731322bf-682b-dc55-4eef-dd89098b7383"
AFTERMATH_HASH = "0123456789abcdef"

DXIL_BYTES = b"DXBC" + b"\x00" * 60


def _write(tmp_path: Path, name: str, data: bytes) -> str:
    path = tmp_path / name
    path.write_bytes(data)
    return str(path)


def test_dxil_format_registered() -> None:
    assert KNOWN_DIF_FORMATS["application/x-dxil"] == "dxil"
    assert DIF_MIMETYPES["dxil"] == "application/x-dxil"
    assert _dif_file_extension("dxil", "dxil") == ".dxil"


def test_determine_dif_kind_dxil(tmp_path: Path) -> None:
    assert determine_dif_kind(_write(tmp_path, "a.dxil", DXIL_BYTES)) == DifKind.Dxil


def test_detect_dxil(tmp_path: Path) -> None:
    path = _write(tmp_path, "shader.dxil", DXIL_BYTES)

    (meta,) = detect_dif_from_path(
        path, name="shader.dxil", debug_id=DXC_HASH, code_id=AFTERMATH_HASH.upper()
    )

    assert meta.file_format == "dxil"
    assert meta.arch == "any"
    assert meta.debug_id == DEBUG_ID
    assert meta.code_id == AFTERMATH_HASH
    assert meta.name == "shader.dxil"
    assert meta.data == {"features": ["symtab"]}
    assert _get_dif_object_name(meta) == "shader.dxil"


def test_detect_dxil_without_code_id(tmp_path: Path) -> None:
    path = _write(tmp_path, "shader.dxil", DXIL_BYTES)

    meta = detect_single_dif_from_path(path, name="shader.dxil", debug_id=DEBUG_ID)

    assert meta.file_format == "dxil"
    assert meta.code_id is None


def test_detect_dxil_requires_debug_id(tmp_path: Path) -> None:
    path = _write(tmp_path, "shader.dxil", DXIL_BYTES)

    with pytest.raises(BadDif, match="Missing debug_id"):
        detect_dif_from_path(path, name="shader.dxil")


def test_detect_dxil_rejects_invalid_debug_id(tmp_path: Path) -> None:
    path = _write(tmp_path, "shader.dxil", DXIL_BYTES)

    with pytest.raises(BadDif, match="Invalid debug_id"):
        detect_dif_from_path(path, name="shader.dxil", debug_id="not-a-debug-id")


def test_detect_dxil_rejects_invalid_code_id(tmp_path: Path) -> None:
    path = _write(tmp_path, "shader.dxil", DXIL_BYTES)

    with pytest.raises(BadDif, match="Invalid code_id"):
        detect_dif_from_path(path, name="shader.dxil", debug_id=DXC_HASH, code_id="abc")


@pytest.mark.parametrize(
    "shader_group,stored",
    (("  GlobalShaders ", "GlobalShaders"), (None, None), ("", None), ("   ", None)),
)
def test_detect_dxil_stores_shader_group(
    tmp_path: Path, shader_group: str | None, stored: str | None
) -> None:
    path = _write(tmp_path, "shader.dxil", DXIL_BYTES)

    meta = detect_single_dif_from_path(
        path, name="shader.dxil", debug_id=DXC_HASH, shader_group=shader_group
    )

    expected: dict[str, object] = {"features": ["symtab"]}
    if stored is not None:
        expected["shader_group"] = stored
    assert meta.data == expected


def test_detect_dxil_rejects_overlong_shader_group(tmp_path: Path) -> None:
    path = _write(tmp_path, "shader.dxil", DXIL_BYTES)

    with pytest.raises(BadDif, match="Invalid shader_group"):
        detect_dif_from_path(
            path,
            name="shader.dxil",
            debug_id=DXC_HASH,
            shader_group="g" * (SHADER_GROUP_MAX_LENGTH + 1),
        )


def _create_shader_dif(
    project: Project, tmp_path: Path, name: str, data: bytes, shader_group: str | None
) -> tuple[ProjectDebugFile, bool]:
    path = _write(tmp_path, name, data)
    meta = detect_single_dif_from_path(
        path, name=name, debug_id=DXC_HASH, code_id=AFTERMATH_HASH, shader_group=shader_group
    )
    session = mock.Mock()
    session.put.return_value = f"difs/{name}"
    with mock.patch("sentry.models.debugfile.get_session", return_value=session):
        return create_dif_from_fileobj(project, meta, io.BytesIO(data))


@django_db_all
def test_create_dxil_stores_shader_group(default_project: Project, tmp_path: Path) -> None:
    dif, created = _create_shader_dif(default_project, tmp_path, "a.dxil", DXIL_BYTES, "Group A")

    assert created is True
    dif.refresh_from_db()
    assert dif.file_format == "dxil"
    assert dif.data["shader_group"] == "Group A"


@django_db_all
def test_assemble_backfills_shader_group_for_known_checksum(
    default_project: Project, tmp_path: Path
) -> None:
    first, _ = _create_shader_dif(default_project, tmp_path, "a.dxil", DXIL_BYTES, None)
    assert first.checksum is not None

    response = batch_assemble(
        default_project,
        {
            first.checksum: {
                "name": "a.dxil",
                "debug_id": DEBUG_ID,
                "chunks": [first.checksum],
                "code_id": AFTERMATH_HASH,
                "shader_group": "Group A",
            }
        },
    )

    assert response[first.checksum]["state"] == ChunkFileState.OK
    first.refresh_from_db()
    assert first.data["shader_group"] == "Group A"


@django_db_all
def test_assemble_backfills_shader_group_despite_cached_ok_status(
    default_project: Project, tmp_path: Path
) -> None:
    first, _ = _create_shader_dif(default_project, tmp_path, "a.dxil", DXIL_BYTES, None)
    assert first.checksum is not None
    set_assemble_status(
        AssembleTask.DIF, default_project.id, first.checksum, ChunkFileState.OK, detail=None
    )

    response = batch_assemble(
        default_project,
        {
            first.checksum: {
                "name": "a.dxil",
                "debug_id": DEBUG_ID,
                "chunks": [first.checksum],
                "code_id": AFTERMATH_HASH,
                "shader_group": "Group A",
            }
        },
    )

    assert response[first.checksum]["state"] == ChunkFileState.OK
    first.refresh_from_db()
    assert first.data["shader_group"] == "Group A"
