"""Resolve the shader debug files teapot reports missing to presigned URLs.

``missing_difs`` names two shader kinds: ``dxil`` (the DXC binary, keyed by the
16-hex Aftermath shader hash stored as ``code_id``) and ``dxil_pdb`` (the DXC PDB,
keyed by its DebugName, whose stem is the DXC hash and therefore the ``debug_id``).
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

SHADER_DIF_URL_VALIDITY = timedelta(minutes=15)

_PDB_SUFFIX_RE = re.compile(r"\.pdb$", re.IGNORECASE)


@dataclass
class ShaderDifs:
    """Entries for teapot's ``shader_binaries`` and ``shader_pdbs`` request arrays."""

    binaries: list[dict[str, str]] = field(default_factory=list)
    pdbs: list[dict[str, str]] = field(default_factory=list)

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
        if entry.get("kind") == "dxil":
            code_ids.append(debug_id)
        elif entry.get("kind") == "dxil_pdb":
            debug_names.append(debug_id)
    return code_ids, debug_names


def debug_id_from_debug_name(debug_name: str) -> str | None:
    stem = _PDB_SUFFIX_RE.sub("", os.path.basename(debug_name.replace("\\", "/")))
    try:
        return normalize_debug_id(stem)
    except SymbolicError:
        return None


def _presigned_dif(
    project_id: int, dif_type: str, **filters: str
) -> tuple[ProjectDebugFile, str] | None:
    """The newest debug file of ``dif_type`` matching ``filters`` with a presigned GET
    URL, or None if there is none or it is not in objectstore."""
    difs = ProjectDebugFile.objects.filter(project_id=project_id, **filters).order_by("-id")
    dif = next((dif for dif in difs if dif.file_type == dif_type), None)
    if dif is None:
        return None
    if not dif.storage_path:
        logger.info(
            "gpu_crash.shader_dif.not_in_objectstore",
            extra={"dif_id": dif.id, "debug_id": dif.debug_id, "type": dif_type},
        )
        return None
    url = get_internal_download_url(
        dif.get_objectstore_session(), dif.storage_path, token_validity=SHADER_DIF_URL_VALIDITY
    )
    return dif, url


def _pdb_debug_name(pdb: ProjectDebugFile) -> str:
    name = os.path.basename((pdb.object_name or "").replace("\\", "/"))
    if _PDB_SUFFIX_RE.search(name):
        return name
    return f"{pdb.debug_id.replace('-', '')[:32]}.pdb"


def resolve_shader_difs(project: Project, response: Mapping[str, Any]) -> ShaderDifs:
    """Look up every shader DIF teapot reported missing and presign the ones we hold.

    The PDB uploaded next to a resolved binary is sent along, since teapot only asks
    for a shader's PDB once it has the binary.
    """
    code_ids, debug_names = missing_shader_difs(response)
    resolved = ShaderDifs()
    found: list[ProjectDebugFile] = []
    requested_pdbs = {name.lower() for name in debug_names}

    for code_id in dict.fromkeys(code_ids):
        dxil_match = _presigned_dif(project.id, "dxil", code_id=code_id.lower())
        if dxil_match is None:
            continue
        dxil, url = dxil_match
        found.append(dxil)
        entry = {"code_id": code_id.lower(), "storage_url": url}
        if group := (dxil.data or {}).get("shader_group"):
            entry["group"] = group
        resolved.binaries.append(entry)

        pdb_match = _presigned_dif(project.id, "dxilpdb", debug_id=dxil.debug_id)
        if pdb_match is None:
            continue
        pdb, pdb_url = pdb_match
        debug_name = _pdb_debug_name(pdb)
        if debug_name.lower() not in requested_pdbs:
            found.append(pdb)
            resolved.pdbs.append({"debug_name": debug_name, "storage_url": pdb_url})

    for debug_name in dict.fromkeys(debug_names):
        debug_id = debug_id_from_debug_name(debug_name)
        pdb_match = _presigned_dif(project.id, "dxilpdb", debug_id=debug_id) if debug_id else None
        if pdb_match is None:
            continue
        pdb, url = pdb_match
        found.append(pdb)
        resolved.pdbs.append({"debug_name": debug_name, "storage_url": url})

    missing = len(code_ids) + len(debug_names)
    if missing:
        metrics.incr("tasks.gpu_crash.shader_difs.missing", amount=missing)
    if found:
        maybe_renew_debug_files(found)
        metrics.incr("tasks.gpu_crash.shader_difs.resolved", amount=len(found))
    return resolved
