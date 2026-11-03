"""Resolve the shader binaries teapot reports missing to presigned URLs.

``missing_difs`` names them by kind ``dxil`` and the 16-hex Aftermath shader hash
stored as ``code_id``.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

from sentry.debug_files.debug_files import maybe_renew_debug_files
from sentry.models.debugfile import ProjectDebugFile
from sentry.models.project import Project
from sentry.objectstore import get_internal_download_url
from sentry.utils import metrics

SHADER_DIF_URL_VALIDITY = timedelta(minutes=15)


@dataclass
class ShaderDifs:
    """Entries for teapot's ``shader_binaries`` request array."""

    binaries: list[dict[str, str]] = field(default_factory=list)

    def __bool__(self) -> bool:
        return bool(self.binaries)


def missing_shader_difs(response: Mapping[str, Any]) -> list[str]:
    """The dxil code ids in teapot's ``missing_difs``."""
    code_ids: list[str] = []
    for entry in response.get("missing_difs") or []:
        if not isinstance(entry, dict) or entry.get("kind") != "dxil":
            continue
        debug_id = entry.get("debug_id")
        if isinstance(debug_id, str) and debug_id:
            code_ids.append(debug_id)
    return code_ids


def _presigned_dif(
    project_id: int, dif_type: str, **filters: str
) -> tuple[ProjectDebugFile, str] | None:
    """The newest objectstore-backed debug file of ``dif_type`` matching ``filters``
    with a presigned GET URL, or None if there is none."""
    difs = ProjectDebugFile.objects.filter(
        project_id=project_id, storage_path__isnull=False, **filters
    ).order_by("-id")
    dif = next((dif for dif in difs if dif.file_format == dif_type), None)
    if dif is None or not dif.storage_path:
        return None
    url = get_internal_download_url(
        dif.get_objectstore_session(), dif.storage_path, token_validity=SHADER_DIF_URL_VALIDITY
    )
    return dif, url


def resolve_shader_difs(project: Project, response: Mapping[str, Any]) -> ShaderDifs:
    """Look up every shader binary teapot reported missing and presign the ones we hold."""
    code_ids = missing_shader_difs(response)
    resolved = ShaderDifs()
    found: list[ProjectDebugFile] = []

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

    if code_ids:
        metrics.incr("tasks.gpu_crash.shader_difs.missing", amount=len(code_ids))
    if found:
        maybe_renew_debug_files(found)
        metrics.incr("tasks.gpu_crash.shader_difs.resolved", amount=len(found))
    return resolved
