from __future__ import annotations

from pathlib import Path

import pytest

from sentry.constants import KNOWN_DIF_FORMATS
from sentry.models.debugfile import (
    DIF_MIMETYPES,
    BadDif,
    DifKind,
    _dif_file_extension,
    _get_dif_object_name,
    detect_dif_from_path,
    detect_single_dif_from_path,
    determine_dif_kind,
)

DXC_HASH = "731322bf682bdc554eefdd89098b7383"
DEBUG_ID = "731322bf-682b-dc55-4eef-dd89098b7383"
AFTERMATH_HASH = "0123456789abcdef"

DXIL_BYTES = b"DXBC" + b"\x00" * 60
MSF_MAGIC = b"Microsoft C/C++ MSF 7.00\r\n\x1aDS\x00\x00\x00"
DXIL_PDB_BYTES = MSF_MAGIC + b"\x00" * 4096 + b"ILDN" + b"\x00" * 64
PLAIN_PDB_BYTES = MSF_MAGIC + b"\x00" * 4096


def _write(tmp_path: Path, name: str, data: bytes) -> str:
    path = tmp_path / name
    path.write_bytes(data)
    return str(path)


def test_shader_formats_registered() -> None:
    assert KNOWN_DIF_FORMATS["application/x-dxil"] == "dxil"
    assert KNOWN_DIF_FORMATS["application/x-dxil-pdb"] == "dxilpdb"
    assert DIF_MIMETYPES["dxil"] == "application/x-dxil"
    assert DIF_MIMETYPES["dxilpdb"] == "application/x-dxil-pdb"
    assert _dif_file_extension("dxil", "dxil") == ".dxil"
    assert _dif_file_extension("dxilpdb", "dxilpdb") == ".pdb"


def test_determine_dif_kind_dxil(tmp_path: Path) -> None:
    assert determine_dif_kind(_write(tmp_path, "a.dxil", DXIL_BYTES)) == DifKind.Dxil


def test_determine_dif_kind_dxil_pdb(tmp_path: Path) -> None:
    assert determine_dif_kind(_write(tmp_path, "a.pdb", DXIL_PDB_BYTES)) == DifKind.DxilPdb


def test_determine_dif_kind_plain_pdb_is_object(tmp_path: Path) -> None:
    # A regular MSF PDB has no ILDN part and stays with symbolic.
    assert determine_dif_kind(_write(tmp_path, "a.pdb", PLAIN_PDB_BYTES)) == DifKind.Object


def test_determine_dif_kind_ildn_outside_scan_window_is_object(tmp_path: Path) -> None:
    data = MSF_MAGIC + b"\x00" * (64 * 1024) + b"ILDN"
    assert determine_dif_kind(_write(tmp_path, "a.pdb", data)) == DifKind.Object


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
    assert meta.data == {"type": "dxil", "features": ["symtab"]}
    assert _get_dif_object_name(meta) == "shader.dxil"


def test_detect_dxil_without_code_id(tmp_path: Path) -> None:
    path = _write(tmp_path, "shader.dxil", DXIL_BYTES)

    meta = detect_single_dif_from_path(path, name="shader.dxil", debug_id=DEBUG_ID)

    assert meta.file_format == "dxil"
    assert meta.code_id is None


def test_detect_dxil_pdb(tmp_path: Path) -> None:
    path = _write(tmp_path, f"{DXC_HASH}.pdb", DXIL_PDB_BYTES)

    meta = detect_single_dif_from_path(path, name=f"{DXC_HASH}.pdb", debug_id=DXC_HASH)

    assert meta.file_format == "dxilpdb"
    assert meta.arch == "any"
    assert meta.debug_id == DEBUG_ID
    assert meta.code_id is None
    assert meta.data == {"type": "dxilpdb", "features": ["debug"]}
    assert _get_dif_object_name(meta) == f"{DXC_HASH}.pdb"


@pytest.mark.parametrize("data", (DXIL_BYTES, DXIL_PDB_BYTES))
def test_detect_shader_requires_debug_id(tmp_path: Path, data: bytes) -> None:
    path = _write(tmp_path, "shader.bin", data)

    with pytest.raises(BadDif, match="Missing debug_id"):
        detect_dif_from_path(path, name="shader.bin")


def test_detect_shader_rejects_invalid_debug_id(tmp_path: Path) -> None:
    path = _write(tmp_path, "shader.dxil", DXIL_BYTES)

    with pytest.raises(BadDif, match="Invalid debug_id"):
        detect_dif_from_path(path, name="shader.dxil", debug_id="not-a-debug-id")


def test_detect_dxil_rejects_invalid_code_id(tmp_path: Path) -> None:
    path = _write(tmp_path, "shader.dxil", DXIL_BYTES)

    with pytest.raises(BadDif, match="Invalid code_id"):
        detect_dif_from_path(path, name="shader.dxil", debug_id=DXC_HASH, code_id="abc")
