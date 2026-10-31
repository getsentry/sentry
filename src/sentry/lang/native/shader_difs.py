"""Resolve the shader debug files teapot reports missing to presigned URLs.

teapot's ``missing_difs`` names two shader kinds: ``dxil`` (the DXC shader
binary, keyed by the 16-hex Aftermath shader hash, stored as ``code_id``) and
``dxil_pdb`` (the DXC shader PDB, keyed by its DebugName, whose stem is the DXC
hash and therefore the ``debug_id``). Both are uploaded as regular project debug
files; only objectstore-backed rows can be presigned.
"""

from __future__ import annotations

import logging
import os
import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

from symbolic.debuginfo import normalize_debug_id
from symbolic.exceptions import SymbolicError

from sentry.debug_files.debug_files import maybe_renew_debug_files
from sentry.models.debugfile import ProjectDebugFile
from sentry.models.project import Project
from sentry.objectstore import get_internal_download_url
from sentry.utils import metrics

logger = logging.getLogger(__name__)

MISSING_DIF_KIND_DXIL = "dxil"
MISSING_DIF_KIND_DXIL_PDB = "dxil_pdb"

DIF_TYPE_DXIL = "dxil"
DIF_TYPE_DXIL_PDB = "dxilpdb"

SHADER_DIF_URL_VALIDITY = timedelta(minutes=15)

_CODE_ID_RE = re.compile(r"^[0-9a-fA-F]{16}$")
_PDB_SUFFIX_RE = re.compile(r"\.pdb$", re.IGNORECASE)

ShaderFileRef = tuple[str, str]
"""``(key, storage_url)``: the key teapot asked for and a presigned GET URL."""


@dataclass
class ShaderDifs:
    binaries: list[ShaderFileRef] = field(default_factory=list)
    pdbs: list[ShaderFileRef] = field(default_factory=list)

    def __bool__(self) -> bool:
        return bool(self.binaries or self.pdbs)


def missing_shader_difs(response: Mapping[str, Any]) -> tuple[list[str], list[str]]:
    """Split teapot's ``missing_difs`` into dxil code ids and dxil_pdb debug names."""
    code_ids: list[str] = []
    debug_names: list[str] = []
    for entry in response.get("missing_difs") or []:
        if not isinstance(entry, dict):
            continue
        debug_id = entry.get("debug_id")
        if not isinstance(debug_id, str) or not debug_id:
            continue
        kind = entry.get("kind")
        if kind == MISSING_DIF_KIND_DXIL:
            code_ids.append(debug_id)
        elif kind == MISSING_DIF_KIND_DXIL_PDB:
            debug_names.append(debug_id)
    return code_ids, debug_names


def debug_id_from_debug_name(debug_name: str) -> str | None:
    stem = _PDB_SUFFIX_RE.sub("", os.path.basename(debug_name.replace("\\", "/")))
    try:
        return normalize_debug_id(stem)
    except SymbolicError:
        return None


def find_dxil_by_code_id(project: Project, code_id: str) -> ProjectDebugFile | None:
    if not _CODE_ID_RE.match(code_id):
        return None
    difs = ProjectDebugFile.objects.filter(
        project_id=project.id, code_id=code_id.lower()
    ).order_by("-id")
    return next((dif for dif in difs if dif.file_type == DIF_TYPE_DXIL), None)


def find_dxil_pdb_by_debug_name(project: Project, debug_name: str) -> ProjectDebugFile | None:
    debug_id = debug_id_from_debug_name(debug_name)
    if debug_id is None:
        return None
    difs = ProjectDebugFile.objects.filter(project_id=project.id, debug_id=debug_id).order_by(
        "-id"
    )
    return next((dif for dif in difs if dif.file_type == DIF_TYPE_DXIL_PDB), None)


def find_sibling_pdb(dxil: ProjectDebugFile) -> tuple[str, ProjectDebugFile] | None:
    """The PDB uploaded next to a DXIL binary, keyed by the DebugName the decoder will ask for.

    The decoder requests a shader's PDB only after it has received the binary, so
    sending the sibling PDB along with the binary saves one extra round trip.
    """
    difs = ProjectDebugFile.objects.filter(project_id=dxil.project_id, debug_id=dxil.debug_id).order_by(
        "-id"
    )
    pdb = next((dif for dif in difs if dif.file_type == DIF_TYPE_DXIL_PDB), None)
    if pdb is None:
        return None
    name = os.path.basename((pdb.object_name or "").replace("\\", "/"))
    if not _PDB_SUFFIX_RE.search(name):
        name = f"{dxil.debug_id.replace('-', '')[:32]}.pdb"
    return name, pdb


def presign_dif(dif: ProjectDebugFile) -> str | None:
    """Presigned GET URL for an objectstore-backed debug file, or None."""
    if not dif.storage_path:
        logger.info(
            "gpu_crash.shader_dif.not_in_objectstore",
            extra={"dif_id": dif.id, "debug_id": dif.debug_id, "type": dif.file_type},
        )
        return None
    return get_internal_download_url(
        dif.get_objectstore_session(), dif.storage_path, token_validity=SHADER_DIF_URL_VALIDITY
    )


def resolve_shader_difs(project: Project, response: Mapping[str, Any]) -> ShaderDifs:
    """Look up every shader DIF teapot reported missing and presign the ones we hold."""
    code_ids, debug_names = missing_shader_difs(response)
    resolved = ShaderDifs()
    found: list[ProjectDebugFile] = []

    for code_id in dict.fromkeys(code_ids):
        dif = find_dxil_by_code_id(project, code_id)
        url = presign_dif(dif) if dif is not None else None
        if dif is not None and url is not None:
            found.append(dif)
            resolved.binaries.append((code_id.lower(), url))
            sibling = find_sibling_pdb(dif)
            if sibling is not None:
                debug_name, pdb = sibling
                pdb_url = presign_dif(pdb)
                if pdb_url is not None and debug_name.lower() not in {n.lower() for n in debug_names}:
                    found.append(pdb)
                    resolved.pdbs.append((debug_name, pdb_url))

    for debug_name in dict.fromkeys(debug_names):
        dif = find_dxil_pdb_by_debug_name(project, debug_name)
        url = presign_dif(dif) if dif is not None else None
        if dif is not None and url is not None:
            found.append(dif)
            resolved.pdbs.append((debug_name, url))

    missing = len(code_ids) + len(debug_names)
    if missing:
        metrics.incr("tasks.gpu_crash.shader_difs.missing", amount=missing)
    if found:
        maybe_renew_debug_files(found)
        metrics.incr("tasks.gpu_crash.shader_difs.resolved", amount=len(found))
    return resolved
